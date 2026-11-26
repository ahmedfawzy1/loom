import {
  AuditAction,
  CmsContentType,
  Prisma,
  type SiteLanguage,
  type Tag,
  type TagLocale,
  type TagVersion,
} from "@loom/database";
import type {
  ContentItemResponseDto,
  CreateTagRequestDto,
  ListContentRequestDto,
  UpdateTagLocaleRequestDto,
  UpdateTagRequestDto,
} from "@loom/dto";
import { TAG_TITLE_MAX_LENGTH } from "@loom/dto/constants";
import {
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
import { assertSlugFree, copySlug, copyTitle } from "../content/slug.util";
import type { TagSnapshot } from "../content/snapshot.util";
import { VersionService } from "../content/version.service";
import { MediaService } from "../media/media.service";
import { PrismaService } from "../prisma/prisma.service";

const TAG_INCLUDE = {
  locales: { orderBy: { languageCode: "asc" } },
} as const;

@Injectable()
export class TagService {
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
      CmsContentType.TAG,
      query,
      space.site.defaultLanguage,
    );
  }

  async get(tagId: Tag["id"]) {
    const tag = await this.prisma.tag.findUnique({
      where: { id: tagId },
      include: TAG_INCLUDE,
    });
    if (!tag) throw new NotFoundException(`Tag ${tagId} not found`);
    return tag;
  }

  async create(actor: AuthenticatedUser, args: CreateTagRequestDto) {
    const space = await this.context.requireSpace(args.spaceId);
    await this.assertSlugAvailable(args.spaceId, args.slug);
    await this.assertImagesFit(args);

    const { title, description } = normaliseLocaleText(
      { title: args.title, description: args.description },
      ["title", "description"],
    );

    const tag = await this.prisma.$transaction(async (tx) => {
      const created = await tx.tag.create({
        data: {
          spaceId: args.spaceId,
          slug: args.slug,
          featuredImageId: args.featuredImageId,
          createdById: actor.id,
          locales: {
            create: {
              spaceId: args.spaceId,
              languageCode: space.site.defaultLanguage,
              title,
              description,
            },
          },
        },
        include: { locales: true },
      });
      await this.versions.commit(
        tx,
        CmsContentType.TAG,
        created.locales[0].id,
        actor,
      );
      return created;
    });

    await this.auditService.log(actor, {
      action: AuditAction.CONTENT_CREATED,
      contentType: CmsContentType.TAG,
      contentId: tag.id,
      spaceId: args.spaceId,
      metadata: { slug: tag.slug },
    });

    return this.get(tag.id);
  }

  /** Shared fields, versioned as a save of the default language. */
  async update(
    actor: AuthenticatedUser,
    tagId: Tag["id"],
    args: UpdateTagRequestDto,
  ) {
    const existing = await this.get(tagId);
    assertNotTrashed(existing, CmsContentType.TAG);
    await this.validateCanonical(existing, args);
    const defaultLocale = await this.defaultLocaleOf(existing);

    await this.prisma.$transaction(async (tx) => {
      await tx.tag.update({ where: { id: tagId }, data: args });
      await this.versions.commit(
        tx,
        CmsContentType.TAG,
        defaultLocale.id,
        actor,
      );
    });

    await this.auditService.log(actor, {
      action: AuditAction.CONTENT_EDITED,
      contentType: CmsContentType.TAG,
      contentId: tagId,
      languageCode: defaultLocale.languageCode,
      spaceId: existing.spaceId,
      metadata: { fields: Object.keys(args) },
    });

    return this.get(tagId);
  }

  async updateLocale(
    actor: AuthenticatedUser,
    tagId: Tag["id"],
    languageCode: SiteLanguage["code"],
    args: UpdateTagLocaleRequestDto,
    options: LocaleSaveOptions<UpdateTagRequestDto> = {},
  ) {
    const existing = await this.get(tagId);
    assertNotTrashed(existing, CmsContentType.TAG);
    const { space } = await this.context.requireLanguage(
      existing.spaceId,
      languageCode,
    );
    if (options.canonical)
      await this.validateCanonical(existing, options.canonical);

    const fields = normaliseLocaleText(
      { title: args.title, description: args.description },
      ["title", "description"],
    );

    await this.prisma.$transaction(async (tx) => {
      if (options.canonical)
        await tx.tag.update({ where: { id: tagId }, data: options.canonical });

      const locale = await tx.tagLocale.upsert({
        where: { tagId_languageCode: { tagId, languageCode } },
        create: {
          tagId,
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
        CmsContentType.TAG,
        locale.id,
        actor,
        saveNote(options, space.site.defaultLanguage),
      );
    });

    await this.auditService.log(actor, {
      ...saveAudit(options),
      contentType: CmsContentType.TAG,
      contentId: tagId,
      languageCode,
      spaceId: existing.spaceId,
    });

    return this.get(tagId);
  }

  /** Saves an old version as a new one; shared fields come back only with the default language. */
  async restoreVersion(
    actor: AuthenticatedUser,
    tagId: Tag["id"],
    languageCode: SiteLanguage["code"],
    revision: TagVersion["revision"],
  ) {
    const existing = await this.get(tagId);
    const space = await this.context.requireSpace(existing.spaceId);
    const { snapshot } = await this.versions.get(
      CmsContentType.TAG,
      tagId,
      languageCode,
      revision,
    );
    const restored = snapshot as unknown as TagSnapshot;

    return this.updateLocale(
      actor,
      tagId,
      languageCode,
      { title: restored.title, description: restored.description },
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

  /** A copy with a `-copy` slug, Draft in every language and no history. */
  async duplicate(
    actor: AuthenticatedUser,
    tagId: Tag["id"],
  ): Promise<ContentItemResponseDto> {
    const source = await this.get(tagId);
    assertNotTrashed(source, CmsContentType.TAG);
    const space = await this.context.requireSpace(source.spaceId);
    const defaultLanguage = space.site.defaultLanguage;
    const sourceContentRevision =
      source.locales.find((locale) => locale.languageCode === defaultLanguage)
        ?.contentRevision ?? 1;

    const slug = await copySlug(
      source.slug,
      async (candidate) =>
        (await this.prisma.tag.count({
          where: { spaceId: source.spaceId, slug: candidate },
        })) > 0,
    );

    const created = await this.prisma.$transaction(async (tx) => {
      const tag = await tx.tag.create({
        data: {
          spaceId: source.spaceId,
          slug,
          featuredImageId: source.featuredImageId,
          createdById: actor.id,
          locales: {
            create: source.locales.map((locale) => ({
              spaceId: source.spaceId,
              languageCode: locale.languageCode,
              title:
                locale.languageCode === defaultLanguage
                  ? copyTitle(locale.title, TAG_TITLE_MAX_LENGTH)
                  : locale.title,
              description: locale.description,
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
      for (const locale of tag.locales)
        await this.versions.commit(tx, CmsContentType.TAG, locale.id, actor);
      return tag;
    });

    await this.auditService.log(actor, {
      action: AuditAction.CONTENT_DUPLICATED,
      contentType: CmsContentType.TAG,
      contentId: created.id,
      spaceId: source.spaceId,
      metadata: { from: tagId },
    });

    return { type: CmsContentType.TAG, id: created.id };
  }

  private async validateCanonical(
    existing: Pick<Tag, "id" | "spaceId" | "slug">,
    args: UpdateTagRequestDto,
  ) {
    if (args.slug && args.slug !== existing.slug)
      await this.assertSlugAvailable(existing.spaceId, args.slug, existing.id);
    await this.assertImagesFit(args);
  }

  private assertImagesFit(args: Pick<UpdateTagRequestDto, "featuredImageId">) {
    return this.mediaService.assertImagesFit([
      { mediaId: args.featuredImageId, field: "tag.featuredImage" },
    ]);
  }

  private async defaultLocaleOf(tag: {
    spaceId: Tag["spaceId"];
    locales: TagLocale[];
  }) {
    const space = await this.context.requireSpace(tag.spaceId);
    const locale = tag.locales.find(
      (candidate) => candidate.languageCode === space.site.defaultLanguage,
    );
    if (!locale)
      throw new ConflictException(
        `This tag has no ${space.site.defaultLanguage} version to record the change against`,
      );
    return locale;
  }

  private async assertSlugAvailable(
    spaceId: Tag["spaceId"],
    slug: Tag["slug"],
    excludeId?: Tag["id"],
  ) {
    const holder = await this.prisma.tag.findFirst({
      where: {
        spaceId,
        slug,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      include: { locales: { take: 1, orderBy: { languageCode: "asc" } } },
    });

    assertSlugFree(
      slug,
      holder && {
        id: holder.id,
        title: holder.locales[0]?.title ?? holder.slug,
        deletedAt: holder.deletedAt,
      },
      "tag",
    );
  }
}
