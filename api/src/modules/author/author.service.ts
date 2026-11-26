import {
  AuditAction,
  type Author,
  type AuthorLocale,
  type AuthorVersion,
  CmsContentType,
  Prisma,
  type SiteLanguage,
} from "@loom/database";
import type {
  ContentItemResponseDto,
  CreateAuthorRequestDto,
  ListContentRequestDto,
  UpdateAuthorLocaleRequestDto,
  UpdateAuthorRequestDto,
} from "@loom/dto";
import { AUTHOR_NAME_MAX_LENGTH } from "@loom/dto/constants";
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
import { copyTitle } from "../content/slug.util";
import type { AuthorSnapshot } from "../content/snapshot.util";
import { VersionService } from "../content/version.service";
import { MediaService } from "../media/media.service";
import { PrismaService } from "../prisma/prisma.service";

const AUTHOR_INCLUDE = {
  locales: { orderBy: { languageCode: "asc" } },
} as const;

@Injectable()
export class AuthorService {
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
      CmsContentType.AUTHOR,
      query,
      space.site.defaultLanguage,
    );
  }

  async get(authorId: Author["id"]) {
    const author = await this.prisma.author.findUnique({
      where: { id: authorId },
      include: AUTHOR_INCLUDE,
    });
    if (!author) throw new NotFoundException(`Author ${authorId} not found`);
    return author;
  }

  async create(actor: AuthenticatedUser, args: CreateAuthorRequestDto) {
    const space = await this.context.requireSpace(args.spaceId);
    await this.assertImagesFit(args);

    const { name } = normaliseLocaleText({ name: args.name }, ["name"]);
    const { jobTitle, bio } = normaliseLocaleText({
      jobTitle: args.jobTitle,
      bio: args.bio,
    });

    const author = await this.prisma.$transaction(async (tx) => {
      const created = await tx.author.create({
        data: {
          spaceId: args.spaceId,
          name,
          profileImageId: args.profileImageId,
          socialLinks: args.socialLinks ?? [],
          createdById: actor.id,
          locales: {
            create: {
              spaceId: args.spaceId,
              languageCode: space.site.defaultLanguage,
              jobTitle,
              bio,
            },
          },
        },
        include: { locales: true },
      });
      await this.versions.commit(
        tx,
        CmsContentType.AUTHOR,
        created.locales[0].id,
        actor,
      );
      return created;
    });

    await this.auditService.log(actor, {
      action: AuditAction.CONTENT_CREATED,
      contentType: CmsContentType.AUTHOR,
      contentId: author.id,
      spaceId: args.spaceId,
      metadata: { name: author.name },
    });

    return this.get(author.id);
  }

  /** Shared fields — the byline itself — versioned as a save of the default language. */
  async update(
    actor: AuthenticatedUser,
    authorId: Author["id"],
    args: UpdateAuthorRequestDto,
  ) {
    const existing = await this.get(authorId);
    assertNotTrashed(existing, CmsContentType.AUTHOR);
    await this.assertImagesFit(args);
    const defaultLocale = await this.defaultLocaleOf(existing);

    await this.prisma.$transaction(async (tx) => {
      await tx.author.update({
        where: { id: authorId },
        data: this.canonicalData(args),
      });
      await this.versions.commit(
        tx,
        CmsContentType.AUTHOR,
        defaultLocale.id,
        actor,
      );
    });

    await this.auditService.log(actor, {
      action: AuditAction.CONTENT_EDITED,
      contentType: CmsContentType.AUTHOR,
      contentId: authorId,
      languageCode: defaultLocale.languageCode,
      spaceId: existing.spaceId,
      metadata: { fields: Object.keys(args) },
    });

    return this.get(authorId);
  }

  async updateLocale(
    actor: AuthenticatedUser,
    authorId: Author["id"],
    languageCode: SiteLanguage["code"],
    args: UpdateAuthorLocaleRequestDto,
    options: LocaleSaveOptions<UpdateAuthorRequestDto> = {},
  ) {
    const existing = await this.get(authorId);
    assertNotTrashed(existing, CmsContentType.AUTHOR);
    const { space } = await this.context.requireLanguage(
      existing.spaceId,
      languageCode,
    );
    if (options.canonical) await this.assertImagesFit(options.canonical);

    const fields = normaliseLocaleText({
      jobTitle: args.jobTitle,
      bio: args.bio,
    });

    await this.prisma.$transaction(async (tx) => {
      if (options.canonical)
        await tx.author.update({
          where: { id: authorId },
          data: this.canonicalData(options.canonical),
        });

      const locale = await tx.authorLocale.upsert({
        where: { authorId_languageCode: { authorId, languageCode } },
        create: {
          authorId,
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
        CmsContentType.AUTHOR,
        locale.id,
        actor,
        saveNote(options, space.site.defaultLanguage),
      );
    });

    await this.auditService.log(actor, {
      ...saveAudit(options),
      contentType: CmsContentType.AUTHOR,
      contentId: authorId,
      languageCode,
      spaceId: existing.spaceId,
    });

    return this.get(authorId);
  }

  /** Saves an old version as a new one; the byline comes back only with the default language. */
  async restoreVersion(
    actor: AuthenticatedUser,
    authorId: Author["id"],
    languageCode: SiteLanguage["code"],
    revision: AuthorVersion["revision"],
  ) {
    const existing = await this.get(authorId);
    const space = await this.context.requireSpace(existing.spaceId);
    const { snapshot } = await this.versions.get(
      CmsContentType.AUTHOR,
      authorId,
      languageCode,
      revision,
    );
    const restored = snapshot as unknown as AuthorSnapshot;

    return this.updateLocale(
      actor,
      authorId,
      languageCode,
      { jobTitle: restored.jobTitle, bio: restored.bio },
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

  /** A copy named "… (copy)", Draft in every language and no history. */
  async duplicate(
    actor: AuthenticatedUser,
    authorId: Author["id"],
  ): Promise<ContentItemResponseDto> {
    const source = await this.get(authorId);
    assertNotTrashed(source, CmsContentType.AUTHOR);
    const space = await this.context.requireSpace(source.spaceId);
    const sourceContentRevision =
      source.locales.find(
        (locale) => locale.languageCode === space.site.defaultLanguage,
      )?.contentRevision ?? 1;

    const created = await this.prisma.$transaction(async (tx) => {
      const author = await tx.author.create({
        data: {
          spaceId: source.spaceId,
          name: copyTitle(source.name, AUTHOR_NAME_MAX_LENGTH),
          profileImageId: source.profileImageId,
          socialLinks: source.socialLinks,
          createdById: actor.id,
          locales: {
            create: source.locales.map((locale) => ({
              spaceId: source.spaceId,
              languageCode: locale.languageCode,
              jobTitle: locale.jobTitle,
              bio: locale.bio,
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
      for (const locale of author.locales)
        await this.versions.commit(tx, CmsContentType.AUTHOR, locale.id, actor);
      return author;
    });

    await this.auditService.log(actor, {
      action: AuditAction.CONTENT_DUPLICATED,
      contentType: CmsContentType.AUTHOR,
      contentId: created.id,
      spaceId: source.spaceId,
      metadata: { from: authorId },
    });

    return { type: CmsContentType.AUTHOR, id: created.id };
  }

  private canonicalData(args: UpdateAuthorRequestDto) {
    return args.name
      ? { ...args, ...normaliseLocaleText({ name: args.name }, ["name"]) }
      : args;
  }

  private assertImagesFit(
    args: Pick<UpdateAuthorRequestDto, "profileImageId">,
  ) {
    return this.mediaService.assertImagesFit([
      { mediaId: args.profileImageId, field: "author.profileImage" },
    ]);
  }

  private async defaultLocaleOf(author: {
    spaceId: Author["spaceId"];
    locales: AuthorLocale[];
  }) {
    const space = await this.context.requireSpace(author.spaceId);
    const locale = author.locales.find(
      (candidate) => candidate.languageCode === space.site.defaultLanguage,
    );
    if (!locale)
      throw new ConflictException(
        `This author has no ${space.site.defaultLanguage} version to record the change against`,
      );
    return locale;
  }
}
