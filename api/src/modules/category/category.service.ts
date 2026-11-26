import {
  AuditAction,
  type Category,
  type CategoryLocale,
  type CategoryVersion,
  CmsContentType,
  Prisma,
  type SiteLanguage,
} from "@loom/database";
import type {
  ContentItemResponseDto,
  CreateCategoryRequestDto,
  ListContentRequestDto,
  UpdateCategoryLocaleRequestDto,
  UpdateCategoryRequestDto,
} from "@loom/dto";
import { CATEGORY_TITLE_MAX_LENGTH } from "@loom/dto/constants";
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
import type { CategorySnapshot } from "../content/snapshot.util";
import { VersionService } from "../content/version.service";
import { MediaService } from "../media/media.service";
import { PrismaService } from "../prisma/prisma.service";

const CATEGORY_INCLUDE = {
  locales: { orderBy: { languageCode: "asc" } },
} as const;

@Injectable()
export class CategoryService {
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
      CmsContentType.CATEGORY,
      query,
      space.site.defaultLanguage,
    );
  }

  async get(categoryId: Category["id"]) {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      include: CATEGORY_INCLUDE,
    });
    if (!category)
      throw new NotFoundException(`Category ${categoryId} not found`);
    return category;
  }

  async create(actor: AuthenticatedUser, args: CreateCategoryRequestDto) {
    const space = await this.context.requireSpace(args.spaceId);
    await this.assertSlugAvailable(args.spaceId, args.slug);
    await this.assertImagesFit(args);

    const { title, description } = normaliseLocaleText(
      { title: args.title, description: args.description },
      ["title", "description"],
    );

    const category = await this.prisma.$transaction(async (tx) => {
      const created = await tx.category.create({
        data: {
          spaceId: args.spaceId,
          slug: args.slug,
          gameCode: args.gameCode,
          featuredImageId: args.featuredImageId,
          featureIconId: args.featureIconId,
          gameCoverId: args.gameCoverId,
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
        CmsContentType.CATEGORY,
        created.locales[0].id,
        actor,
      );
      return created;
    });

    await this.auditService.log(actor, {
      action: AuditAction.CONTENT_CREATED,
      contentType: CmsContentType.CATEGORY,
      contentId: category.id,
      spaceId: args.spaceId,
      metadata: { slug: category.slug },
    });

    return this.get(category.id);
  }

  /** Shared fields, versioned as a save of the default language. */
  async update(
    actor: AuthenticatedUser,
    categoryId: Category["id"],
    args: UpdateCategoryRequestDto,
  ) {
    const existing = await this.get(categoryId);
    assertNotTrashed(existing, CmsContentType.CATEGORY);
    await this.validateCanonical(existing, args);
    const defaultLocale = await this.defaultLocaleOf(existing);

    await this.prisma.$transaction(async (tx) => {
      await tx.category.update({ where: { id: categoryId }, data: args });
      await this.versions.commit(
        tx,
        CmsContentType.CATEGORY,
        defaultLocale.id,
        actor,
      );
    });

    await this.auditService.log(actor, {
      action: AuditAction.CONTENT_EDITED,
      contentType: CmsContentType.CATEGORY,
      contentId: categoryId,
      languageCode: defaultLocale.languageCode,
      spaceId: existing.spaceId,
      metadata: { fields: Object.keys(args) },
    });

    return this.get(categoryId);
  }

  async updateLocale(
    actor: AuthenticatedUser,
    categoryId: Category["id"],
    languageCode: SiteLanguage["code"],
    args: UpdateCategoryLocaleRequestDto,
    options: LocaleSaveOptions<UpdateCategoryRequestDto> = {},
  ) {
    const existing = await this.get(categoryId);
    assertNotTrashed(existing, CmsContentType.CATEGORY);
    const { space } = await this.context.requireLanguage(
      existing.spaceId,
      languageCode,
    );
    if (options.canonical)
      await this.validateCanonical(existing, options.canonical);

    // seoMetaTitle is unique per space+language, and NULLs stay distinct while blanks do not
    const fields = normaliseLocaleText(
      {
        title: args.title,
        description: args.description,
        seoMetaTitle: args.seoMetaTitle,
        seoMetaDescription: args.seoMetaDescription,
      },
      ["title", "description"],
    );

    await this.prisma.$transaction(async (tx) => {
      if (options.canonical)
        await tx.category.update({
          where: { id: categoryId },
          data: options.canonical,
        });

      const locale = await tx.categoryLocale.upsert({
        where: { categoryId_languageCode: { categoryId, languageCode } },
        create: {
          categoryId,
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
        CmsContentType.CATEGORY,
        locale.id,
        actor,
        saveNote(options, space.site.defaultLanguage),
      );
    });

    await this.auditService.log(actor, {
      ...saveAudit(options),
      contentType: CmsContentType.CATEGORY,
      contentId: categoryId,
      languageCode,
      spaceId: existing.spaceId,
    });

    return this.get(categoryId);
  }

  /** Saves an old version as a new one; shared fields come back only with the default language. */
  async restoreVersion(
    actor: AuthenticatedUser,
    categoryId: Category["id"],
    languageCode: SiteLanguage["code"],
    revision: CategoryVersion["revision"],
  ) {
    const existing = await this.get(categoryId);
    const space = await this.context.requireSpace(existing.spaceId);
    const { snapshot } = await this.versions.get(
      CmsContentType.CATEGORY,
      categoryId,
      languageCode,
      revision,
    );
    const restored = snapshot as unknown as CategorySnapshot;

    return this.updateLocale(
      actor,
      categoryId,
      languageCode,
      {
        title: restored.title,
        description: restored.description,
        seoMetaTitle: restored.seoMetaTitle,
        seoMetaDescription: restored.seoMetaDescription,
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

  /**
   * A copy with a `-copy` slug, Draft in every language and no history. The SEO title is not
   * copied: it is unique per language, so a copy carrying it could not be saved at all.
   */
  async duplicate(
    actor: AuthenticatedUser,
    categoryId: Category["id"],
  ): Promise<ContentItemResponseDto> {
    const source = await this.get(categoryId);
    assertNotTrashed(source, CmsContentType.CATEGORY);
    const space = await this.context.requireSpace(source.spaceId);
    const defaultLanguage = space.site.defaultLanguage;
    const sourceContentRevision =
      source.locales.find((locale) => locale.languageCode === defaultLanguage)
        ?.contentRevision ?? 1;

    const slug = await copySlug(
      source.slug,
      async (candidate) =>
        (await this.prisma.category.count({
          where: { spaceId: source.spaceId, slug: candidate },
        })) > 0,
    );

    const created = await this.prisma.$transaction(async (tx) => {
      const category = await tx.category.create({
        data: {
          spaceId: source.spaceId,
          slug,
          gameCode: source.gameCode,
          featuredImageId: source.featuredImageId,
          featureIconId: source.featureIconId,
          gameCoverId: source.gameCoverId,
          createdById: actor.id,
          locales: {
            create: source.locales.map((locale) => ({
              spaceId: source.spaceId,
              languageCode: locale.languageCode,
              title:
                locale.languageCode === defaultLanguage
                  ? copyTitle(locale.title, CATEGORY_TITLE_MAX_LENGTH)
                  : locale.title,
              description: locale.description,
              seoMetaTitle: null,
              seoMetaDescription: locale.seoMetaDescription,
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
      for (const locale of category.locales)
        await this.versions.commit(
          tx,
          CmsContentType.CATEGORY,
          locale.id,
          actor,
        );
      return category;
    });

    await this.auditService.log(actor, {
      action: AuditAction.CONTENT_DUPLICATED,
      contentType: CmsContentType.CATEGORY,
      contentId: created.id,
      spaceId: source.spaceId,
      metadata: { from: categoryId },
    });

    return { type: CmsContentType.CATEGORY, id: created.id };
  }

  private async validateCanonical(
    existing: Pick<Category, "id" | "spaceId" | "slug">,
    args: UpdateCategoryRequestDto,
  ) {
    if (args.slug && args.slug !== existing.slug)
      await this.assertSlugAvailable(existing.spaceId, args.slug, existing.id);
    await this.assertImagesFit(args);
  }

  private assertImagesFit(
    args: Pick<
      UpdateCategoryRequestDto,
      "featuredImageId" | "featureIconId" | "gameCoverId"
    >,
  ) {
    return this.mediaService.assertImagesFit([
      { mediaId: args.featuredImageId, field: "category.featuredImage" },
      { mediaId: args.featureIconId, field: "category.featureIcon" },
      { mediaId: args.gameCoverId, field: "category.gameCover" },
    ]);
  }

  private async defaultLocaleOf(category: {
    spaceId: Category["spaceId"];
    locales: CategoryLocale[];
  }) {
    const space = await this.context.requireSpace(category.spaceId);
    const locale = category.locales.find(
      (candidate) => candidate.languageCode === space.site.defaultLanguage,
    );
    if (!locale)
      throw new ConflictException(
        `This category has no ${space.site.defaultLanguage} version to record the change against`,
      );
    return locale;
  }

  /** Checked up front so the conflict can name the blocking item, including one in the Trash. */
  private async assertSlugAvailable(
    spaceId: Category["spaceId"],
    slug: Category["slug"],
    excludeId?: Category["id"],
  ) {
    const holder = await this.prisma.category.findFirst({
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
      "category",
    );
  }
}
