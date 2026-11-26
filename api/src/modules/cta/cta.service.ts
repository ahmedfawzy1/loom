import {
  AuditAction,
  CmsContentType,
  type Cta,
  type CtaLocale,
  type CtaVersion,
  Prisma,
  type SiteLanguage,
} from "@loom/database";
import type {
  ContentItemResponseDto,
  CreateCtaRequestDto,
  ListContentRequestDto,
  UpdateCtaLocaleRequestDto,
  UpdateCtaRequestDto,
} from "@loom/dto";
import {
  CTA_TITLE_MAX_LENGTH,
  isCtaUrlOnSite,
  siteHost,
} from "@loom/dto/constants";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import { ContentContextService } from "../content/content-context.service";
import {
  assertNotTrashed,
  copiedSourceRevision,
  initialSourceRevision,
  type LocaleSaveOptions,
  provenanceData,
  restoredProvenance,
  saveAudit,
  saveNote,
} from "../content/content-item.util";
import { ContentQueryService } from "../content/content-query.service";
import { normaliseLocaleText } from "../content/locale-text.util";
import { copyTitle } from "../content/slug.util";
import type { CtaSnapshot } from "../content/snapshot.util";
import { VersionService } from "../content/version.service";
import { MediaService } from "../media/media.service";
import { PrismaService } from "../prisma/prisma.service";

const CTA_INCLUDE = {
  locales: { orderBy: { languageCode: "asc" } },
} as const;

@Injectable()
export class CtaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly context: ContentContextService,
    private readonly queryService: ContentQueryService,
    private readonly mediaService: MediaService,
    private readonly versions: VersionService,
  ) {}

  async list(query: ListContentRequestDto) {
    // requireLanguage, not requireSpace: an unknown code would otherwise return every row marked
    // untranslated, which reads as "nothing here" rather than as the typo it is
    const { space } = await this.context.requireLanguage(
      query.spaceId,
      query.language,
    );
    return this.queryService.list(
      CmsContentType.CTA,
      query,
      space.site.defaultLanguage,
    );
  }

  async get(ctaId: Cta["id"]) {
    const cta = await this.prisma.cta.findUnique({
      where: { id: ctaId },
      include: CTA_INCLUDE,
    });
    if (!cta) throw new NotFoundException(`CTA ${ctaId} not found`);
    return cta;
  }

  async create(actor: AuthenticatedUser, args: CreateCtaRequestDto) {
    const space = await this.context.requireSpace(args.spaceId);
    this.assertUrlOnSite(args.url, space.site.domain);
    await this.assertImagesFit(args);

    const { title, description, buttonLabel } = normaliseLocaleText(
      {
        title: args.title,
        description: args.description,
        buttonLabel: args.buttonLabel,
      },
      ["title", "buttonLabel"],
    );

    const cta = await this.prisma.$transaction(async (tx) => {
      const created = await tx.cta.create({
        data: {
          spaceId: args.spaceId,
          url: args.url,
          cmpid: args.cmpid,
          imageId: args.imageId,
          createdById: actor.id,
          locales: {
            create: {
              spaceId: args.spaceId,
              languageCode: space.site.defaultLanguage,
              title,
              description,
              buttonLabel,
            },
          },
        },
        include: { locales: true },
      });
      await this.versions.commit(
        tx,
        CmsContentType.CTA,
        created.locales[0].id,
        actor,
      );
      return created;
    });

    await this.auditService.log(actor, {
      action: AuditAction.CONTENT_CREATED,
      contentType: CmsContentType.CTA,
      contentId: cta.id,
      spaceId: args.spaceId,
      metadata: { url: cta.url, cmpid: cta.cmpid },
    });

    return this.get(cta.id);
  }

  /** Shared fields, versioned as a save of the default language. */
  async update(
    actor: AuthenticatedUser,
    ctaId: Cta["id"],
    args: UpdateCtaRequestDto,
  ) {
    const existing = await this.get(ctaId);
    assertNotTrashed(existing, CmsContentType.CTA);
    // Only a url this save sets is checked: one already stored was on the Site when it went in, and
    // refusing it after the Site's domain changes would make the CTA unsaveable
    if (args.url !== undefined && args.url !== existing.url) {
      const space = await this.context.requireSpace(existing.spaceId);
      this.assertUrlOnSite(args.url, space.site.domain);
    }
    await this.assertImagesFit(args);
    const defaultLocale = await this.defaultLocaleOf(existing);

    await this.prisma.$transaction(async (tx) => {
      await tx.cta.update({
        where: { id: ctaId },
        data: this.canonicalData(args),
      });
      await this.versions.commit(
        tx,
        CmsContentType.CTA,
        defaultLocale.id,
        actor,
      );
    });

    await this.auditService.log(actor, {
      action: AuditAction.CONTENT_EDITED,
      contentType: CmsContentType.CTA,
      contentId: ctaId,
      languageCode: defaultLocale.languageCode,
      spaceId: existing.spaceId,
      metadata: { fields: Object.keys(args) },
    });

    return this.get(ctaId);
  }

  async updateLocale(
    actor: AuthenticatedUser,
    ctaId: Cta["id"],
    languageCode: SiteLanguage["code"],
    args: UpdateCtaLocaleRequestDto,
    options: LocaleSaveOptions<UpdateCtaRequestDto> = {},
  ) {
    const existing = await this.get(ctaId);
    assertNotTrashed(existing, CmsContentType.CTA);
    const { space } = await this.context.requireLanguage(
      existing.spaceId,
      languageCode,
    );
    if (options.canonical) await this.assertImagesFit(options.canonical);

    const fields = normaliseLocaleText(
      {
        title: args.title,
        description: args.description,
        buttonLabel: args.buttonLabel,
      },
      ["title", "buttonLabel"],
    );

    await this.prisma.$transaction(async (tx) => {
      if (options.canonical)
        await tx.cta.update({
          where: { id: ctaId },
          data: this.canonicalData(options.canonical),
        });

      const locale = await tx.ctaLocale.upsert({
        where: { ctaId_languageCode: { ctaId, languageCode } },
        create: {
          ctaId,
          spaceId: existing.spaceId,
          languageCode,
          ...fields,
          sourceRevision: initialSourceRevision(
            languageCode,
            space.site.defaultLanguage,
            existing.locales,
          ),
          ...provenanceData(options.provenance),
        },
        update: {
          ...fields,
          ...provenanceData(options.provenance),
        },
      });
      await this.versions.commit(
        tx,
        CmsContentType.CTA,
        locale.id,
        actor,
        saveNote(options, space.site.defaultLanguage),
      );
    });

    await this.auditService.log(actor, {
      ...saveAudit(options),
      contentType: CmsContentType.CTA,
      contentId: ctaId,
      languageCode,
      spaceId: existing.spaceId,
    });

    return this.get(ctaId);
  }

  /** Saves an old version as a new one; shared fields come back only with the default language. */
  async restoreVersion(
    actor: AuthenticatedUser,
    ctaId: Cta["id"],
    languageCode: SiteLanguage["code"],
    revision: CtaVersion["revision"],
  ) {
    const existing = await this.get(ctaId);
    const space = await this.context.requireSpace(existing.spaceId);
    const { snapshot } = await this.versions.get(
      CmsContentType.CTA,
      ctaId,
      languageCode,
      revision,
    );
    const restored = snapshot as unknown as CtaSnapshot;

    return this.updateLocale(
      actor,
      ctaId,
      languageCode,
      {
        title: restored.title,
        description: restored.description,
        buttonLabel: restored.buttonLabel,
      },
      {
        canonical:
          languageCode === space.site.defaultLanguage
            ? restored.canonical
            : undefined,
        restoredFrom: revision,
        provenance: restoredProvenance(
          restored.provenance,
          languageCode,
          space.site.defaultLanguage,
        ),
      },
    );
  }

  /** A copy titled "… (copy)", Draft in every language and no history. */
  async duplicate(
    actor: AuthenticatedUser,
    ctaId: Cta["id"],
  ): Promise<ContentItemResponseDto> {
    const source = await this.get(ctaId);
    assertNotTrashed(source, CmsContentType.CTA);
    const space = await this.context.requireSpace(source.spaceId);
    const defaultLanguage = space.site.defaultLanguage;
    const sourceContentRevision =
      source.locales.find((locale) => locale.languageCode === defaultLanguage)
        ?.contentRevision ?? 1;

    const created = await this.prisma.$transaction(async (tx) => {
      const cta = await tx.cta.create({
        data: {
          spaceId: source.spaceId,
          url: source.url,
          cmpid: source.cmpid,
          imageId: source.imageId,
          createdById: actor.id,
          locales: {
            create: source.locales.map((locale) => ({
              spaceId: source.spaceId,
              languageCode: locale.languageCode,
              title:
                locale.languageCode === defaultLanguage
                  ? copyTitle(locale.title, CTA_TITLE_MAX_LENGTH)
                  : locale.title,
              description: locale.description,
              buttonLabel: locale.buttonLabel,
              sourceRevision: copiedSourceRevision(
                locale.sourceRevision,
                sourceContentRevision,
              ),
              ...(locale.sourceBaseline === null
                ? {}
                : {
                    sourceBaseline:
                      locale.sourceBaseline as Prisma.InputJsonValue,
                  }),
            })),
          },
        },
        include: { locales: true },
      });
      for (const locale of cta.locales)
        await this.versions.commit(tx, CmsContentType.CTA, locale.id, actor);
      return cta;
    });

    await this.auditService.log(actor, {
      action: AuditAction.CONTENT_DUPLICATED,
      contentType: CmsContentType.CTA,
      contentId: created.id,
      spaceId: source.spaceId,
      metadata: { from: ctaId },
    });

    return { type: CmsContentType.CTA, id: created.id };
  }

  // cmpid is optional, so a cleared field is null rather than an empty string
  private canonicalData(args: UpdateCtaRequestDto) {
    return args.cmpid === "" ? { ...args, cmpid: null } : args;
  }

  private assertImagesFit(args: Pick<UpdateCtaRequestDto, "imageId">) {
    return this.mediaService.assertImagesFit([
      { mediaId: args.imageId, field: "cta.image" },
    ]);
  }

  /** A CTA renders inside the Site's published pages, so it may only lead somewhere on that Site. */
  private assertUrlOnSite(url: string, siteDomain: string) {
    if (!isCtaUrlOnSite(url, siteDomain))
      throw new BadRequestException(
        `url must be on ${siteHost(siteDomain) || "this site's domain"} (https) or a relative /path`,
      );
  }

  private async defaultLocaleOf(cta: {
    spaceId: Cta["spaceId"];
    locales: CtaLocale[];
  }) {
    const space = await this.context.requireSpace(cta.spaceId);
    const locale = cta.locales.find(
      (candidate) => candidate.languageCode === space.site.defaultLanguage,
    );
    if (!locale)
      throw new ConflictException(
        `This CTA has no ${space.site.defaultLanguage} version to record the change against`,
      );
    return locale;
  }
}
