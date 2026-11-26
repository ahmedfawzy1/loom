import {
  AuditAction,
  type Blog,
  type BlogLocale,
  type BlogTag,
  type BlogVersion,
  CmsContentType,
  Prisma,
  type SiteLanguage,
} from "@loom/database";
import type {
  ContentItemResponseDto,
  CreateBlogRequestDto,
  FaqItemDto,
  ListContentRequestDto,
  UpdateBlogLocaleRequestDto,
  UpdateBlogRequestDto,
} from "@loom/dto";
import {
  BLOG_TITLE_MAX_LENGTH,
  type RichTextEntryType,
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
import {
  collectReferences,
  parseDocument,
  type RichTextNode,
} from "../content/rich-text.util";
import {
  assertSlugFree,
  copySlug,
  copyTitle,
  slugify,
} from "../content/slug.util";
import type { BlogSnapshot } from "../content/snapshot.util";
import { VersionService } from "../content/version.service";
import { MediaService } from "../media/media.service";
import { PrismaService } from "../prisma/prisma.service";
import { EMPTY_DOCUMENT } from "./blog.constants";

/**
 * The references a create or update may carry. Create cannot clear a reference and update can, so
 * the two DTOs disagree on null — this is the shape the check actually needs from either.
 */
interface BlogReferences {
  authorId?: Blog["authorId"];
  reviewerId?: Blog["reviewerId"];
  categoryId?: Blog["categoryId"];
  tagIds?: BlogTag["tagId"][];
}

const BLOG_INCLUDE = {
  locales: { orderBy: { languageCode: "asc" } },
  tags: { orderBy: { position: "asc" } },
} as const;

@Injectable()
export class BlogService {
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
      CmsContentType.BLOG,
      query,
      space.site.defaultLanguage,
    );
  }

  async get(blogId: Blog["id"]) {
    const blog = await this.prisma.blog.findUnique({
      where: { id: blogId },
      include: BLOG_INCLUDE,
    });
    if (!blog) throw new NotFoundException(`Blog ${blogId} not found`);
    return { ...blog, tagIds: blog.tags.map((tag) => tag.tagId) };
  }

  async create(actor: AuthenticatedUser, args: CreateBlogRequestDto) {
    const space = await this.context.requireSpace(args.spaceId);
    await this.assertReferencesInSpace(args.spaceId, args);
    await this.mediaService.assertImagesFit([
      { mediaId: args.imageId, field: "blog.image" },
    ]);

    const { title, description } = normaliseLocaleText(
      { title: args.title, description: args.description },
      ["title", "description"],
    );

    const language = space.site.defaultLanguage;
    const slug = args.slug?.trim() || slugify(title);
    if (!slug)
      throw new BadRequestException(
        "A slug could not be derived from this title — set one explicitly",
      );
    await this.assertSlugAvailable(args.spaceId, language, slug);

    const blog = await this.prisma.$transaction(async (tx) => {
      const created = await tx.blog.create({
        data: {
          spaceId: args.spaceId,
          authorId: args.authorId,
          reviewerId: args.reviewerId,
          categoryId: args.categoryId,
          imageId: args.imageId,
          createdById: actor.id,
          tags: {
            create: (args.tagIds ?? []).map((tagId, position) => ({
              tagId,
              position,
            })),
          },
          locales: {
            create: {
              spaceId: args.spaceId,
              languageCode: language,
              title,
              description,
              slug,
              // The summary stays null rather than "" so the row is not born in a state its own
              // update endpoint rejects — 120–600 is enforced at publish
              summary: null,
              body: EMPTY_DOCUMENT,
              faq: [],
            },
          },
        },
        include: { locales: true },
      });
      await this.versions.commit(
        tx,
        CmsContentType.BLOG,
        created.locales[0].id,
        actor,
      );
      return created;
    });

    await this.auditService.log(actor, {
      action: AuditAction.CONTENT_CREATED,
      contentType: CmsContentType.BLOG,
      contentId: blog.id,
      languageCode: language,
      spaceId: args.spaceId,
      metadata: { slug },
    });

    return this.get(blog.id);
  }

  /**
   * The shared fields. They are edited in the default-language view and recorded as a version of
   * that locale, so they reach the website only when it is published — and reach each
   * translation when that translation is next saved or updated.
   */
  async update(
    actor: AuthenticatedUser,
    blogId: Blog["id"],
    args: UpdateBlogRequestDto,
  ) {
    const existing = await this.get(blogId);
    assertNotTrashed(existing, CmsContentType.BLOG);
    await this.validateCanonical(existing.spaceId, args);
    const defaultLocale = await this.defaultLocaleOf(existing);

    await this.prisma.$transaction(async (tx) => {
      await this.writeCanonical(tx, blogId, args);
      await this.versions.commit(
        tx,
        CmsContentType.BLOG,
        defaultLocale.id,
        actor,
      );
    });

    await this.auditService.log(actor, {
      action: AuditAction.CONTENT_EDITED,
      contentType: CmsContentType.BLOG,
      contentId: blogId,
      languageCode: defaultLocale.languageCode,
      spaceId: existing.spaceId,
      metadata: { fields: Object.keys(args) },
    });

    return this.get(blogId);
  }

  async updateLocale(
    actor: AuthenticatedUser,
    blogId: Blog["id"],
    languageCode: SiteLanguage["code"],
    args: UpdateBlogLocaleRequestDto,
    options: LocaleSaveOptions<UpdateBlogRequestDto> = {},
  ) {
    const existing = await this.get(blogId);
    assertNotTrashed(existing, CmsContentType.BLOG);
    const { space } = await this.context.requireLanguage(
      existing.spaceId,
      languageCode,
    );
    if (options.canonical)
      await this.validateCanonical(existing.spaceId, options.canonical);

    const text = normaliseLocaleText(
      {
        title: args.title,
        description: args.description,
        slug: args.slug,
        summary: args.summary,
        updateNote: args.updateNote,
      },
      // summary is deliberately absent: it is a publish gate, checked by PublishService
      ["title", "description", "slug"],
    );

    await this.assertSlugAvailable(
      existing.spaceId,
      languageCode,
      text.slug,
      blogId,
    );

    const body = args.body ? parseDocument(args.body) : undefined;
    if (body) {
      const stored = existing.locales.find(
        (locale) => locale.languageCode === languageCode,
      )?.body as RichTextNode | undefined;
      // A restore brings back a body that was valid when it was saved, so everything in it is
      // grandfathered the same way an unchanged reference in the current body is
      await this.assertBodyReferences(
        existing.spaceId,
        body,
        options.restoredFrom ? body : stored,
      );
    }

    const fields = {
      ...text,
      // RichTextNode is JSON but, as an interface, has no index signature to prove it
      ...(body ? { body: body as unknown as Prisma.InputJsonValue } : {}),
      ...(args.faq
        ? { faq: args.faq as unknown as Prisma.InputJsonValue }
        : {}),
    };

    await this.prisma.$transaction(async (tx) => {
      if (options.canonical)
        await this.writeCanonical(tx, blogId, options.canonical);

      const locale = await tx.blogLocale.upsert({
        where: { blogId_languageCode: { blogId, languageCode } },
        create: {
          blogId,
          spaceId: existing.spaceId,
          languageCode,
          ...fields,
          sourceRevision: initialSourceRevision(
            languageCode,
            space.site.defaultLanguage,
            existing.locales,
          ),
          ...provenanceData(options.provenance),
          body: fields.body ?? EMPTY_DOCUMENT,
          faq: fields.faq ?? [],
        },
        update: {
          ...fields,
          ...provenanceData(options.provenance),
        },
      });
      await this.versions.commit(
        tx,
        CmsContentType.BLOG,
        locale.id,
        actor,
        saveNote(options, space.site.defaultLanguage),
      );
    });

    await this.auditService.log(actor, {
      ...saveAudit(options),
      contentType: CmsContentType.BLOG,
      contentId: blogId,
      languageCode,
      spaceId: existing.spaceId,
    });

    return this.get(blogId);
  }

  /**
   * Restoring saves the old version again as a new one, so it lands in the restorer's
   * normal state: live content becomes Changed and still needs publishing. The shared fields come
   * back only when restoring the default language — they are that locale's to version.
   */
  async restoreVersion(
    actor: AuthenticatedUser,
    blogId: Blog["id"],
    languageCode: SiteLanguage["code"],
    revision: BlogVersion["revision"],
  ) {
    const existing = await this.get(blogId);
    const space = await this.context.requireSpace(existing.spaceId);
    const { snapshot } = await this.versions.get(
      CmsContentType.BLOG,
      blogId,
      languageCode,
      revision,
    );
    const restored = snapshot as unknown as BlogSnapshot;

    return this.updateLocale(
      actor,
      blogId,
      languageCode,
      {
        title: restored.title,
        description: restored.description,
        slug: restored.slug,
        summary: restored.summary,
        updateNote: restored.updateNote,
        body: restored.body as object,
        faq: restored.faq as unknown as FaqItemDto[],
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
   * A new post with the same content in every language, as Draft, with no history.
   * Each language's slug gets `-copy`, since two posts cannot share one.
   */
  async duplicate(
    actor: AuthenticatedUser,
    blogId: Blog["id"],
  ): Promise<ContentItemResponseDto> {
    const source = await this.get(blogId);
    assertNotTrashed(source, CmsContentType.BLOG);
    const space = await this.context.requireSpace(source.spaceId);
    const defaultLanguage = space.site.defaultLanguage;
    const sourceContentRevision =
      source.locales.find((locale) => locale.languageCode === defaultLanguage)
        ?.contentRevision ?? 1;

    const slugs = new Map<BlogLocale["languageCode"], BlogLocale["slug"]>();
    for (const locale of source.locales)
      slugs.set(
        locale.languageCode,
        await copySlug(
          locale.slug,
          async (candidate) =>
            (await this.prisma.blogLocale.count({
              where: {
                spaceId: source.spaceId,
                languageCode: locale.languageCode,
                slug: candidate,
              },
            })) > 0,
        ),
      );

    const created = await this.prisma.$transaction(async (tx) => {
      const blog = await tx.blog.create({
        data: {
          spaceId: source.spaceId,
          authorId: source.authorId,
          reviewerId: source.reviewerId,
          categoryId: source.categoryId,
          imageId: source.imageId,
          createdById: actor.id,
          tags: {
            create: source.tags.map(({ tagId, position }) => ({
              tagId,
              position,
            })),
          },
          locales: {
            create: source.locales.map((locale) => ({
              spaceId: source.spaceId,
              languageCode: locale.languageCode,
              title:
                locale.languageCode === defaultLanguage
                  ? copyTitle(locale.title, BLOG_TITLE_MAX_LENGTH)
                  : locale.title,
              description: locale.description,
              slug: slugs.get(locale.languageCode) ?? locale.slug,
              summary: locale.summary,
              updateNote: locale.updateNote,
              body: locale.body as Prisma.InputJsonValue,
              faq: locale.faq as Prisma.InputJsonValue,
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
      for (const locale of blog.locales)
        await this.versions.commit(tx, CmsContentType.BLOG, locale.id, actor);
      return blog;
    });

    await this.auditService.log(actor, {
      action: AuditAction.CONTENT_DUPLICATED,
      contentType: CmsContentType.BLOG,
      contentId: created.id,
      spaceId: source.spaceId,
      metadata: { from: blogId },
    });

    return { type: CmsContentType.BLOG, id: created.id };
  }

  private async validateCanonical(
    spaceId: Blog["spaceId"],
    args: UpdateBlogRequestDto,
  ) {
    await this.assertReferencesInSpace(spaceId, args);
    await this.mediaService.assertImagesFit([
      { mediaId: args.imageId, field: "blog.image" },
    ]);
  }

  private async writeCanonical(
    tx: Prisma.TransactionClient,
    blogId: Blog["id"],
    args: UpdateBlogRequestDto,
  ) {
    const { tagIds, ...canonical } = args;
    await tx.blog.update({ where: { id: blogId }, data: canonical });

    // Tags are ordered, so the set is replaced rather than diffed — position is the array index
    if (tagIds) {
      await tx.blogTag.deleteMany({ where: { blogId } });
      await tx.blogTag.createMany({
        data: tagIds.map((tagId, position) => ({ blogId, tagId, position })),
      });
    }
  }

  private async defaultLocaleOf(blog: {
    spaceId: Blog["spaceId"];
    locales: BlogLocale[];
  }) {
    const space = await this.context.requireSpace(blog.spaceId);
    const locale = blog.locales.find(
      (candidate) => candidate.languageCode === space.site.defaultLanguage,
    );
    if (!locale)
      throw new ConflictException(
        `This post has no ${space.site.defaultLanguage} version to record the change against`,
      );
    return locale;
  }

  /**
   * Everything a body newly embeds has to exist, not be in the Trash, and — for CTAs and entries —
   * be in the post's own Space: the same invariant as the canonical references, extended
   * into the document. Images are exempt from the Space check because the library is global,
   * and a deleted image is still an image (see MediaService.requireMedia).
   *
   * Only references this save adds are checked. One already in the stored body was valid when it
   * went in; if its target has since been trashed, refusing it would leave the post unsaveable until
   * someone found the embed — the Trash is where that gets resolved, not here.
   */
  private async assertBodyReferences(
    spaceId: Blog["spaceId"],
    body: RichTextNode,
    stored: RichTextNode | undefined,
  ) {
    const next = collectReferences(body);
    const before = stored ? collectReferences(stored) : undefined;

    const added = (ids: Iterable<string>, existing: Iterable<string> = []) => {
      const known = new Set(existing);
      return [...new Set(ids)].filter((id) => !known.has(id));
    };
    const entryIds = (
      references: typeof next | undefined,
      type: RichTextEntryType,
    ) =>
      (references?.entries ?? [])
        .filter((entry) => entry.type === type)
        .map((entry) => entry.id);
    const addedEntries = (type: RichTextEntryType) =>
      added(entryIds(next, type), entryIds(before, type));

    const ctaIds = added(next.ctaIds, before?.ctaIds);
    const mediaIds = added(next.mediaIds, before?.mediaIds);
    const blogIds = addedEntries("blog");
    const categoryIds = addedEntries("category");
    const tagIds = addedEntries("tag");
    const authorIds = addedEntries("author");

    const checks: {
      label: string;
      expected: number;
      found: Promise<number>;
    }[] = [
      {
        label: "a CTA",
        expected: ctaIds.length,
        found: this.prisma.cta.count({
          where: { id: { in: ctaIds }, spaceId, deletedAt: null },
        }),
      },
      {
        label: "an image",
        expected: mediaIds.length,
        found: this.prisma.media.count({ where: { id: { in: mediaIds } } }),
      },
      {
        label: "a post",
        expected: blogIds.length,
        found: this.prisma.blog.count({
          where: { id: { in: blogIds }, spaceId, deletedAt: null },
        }),
      },
      {
        label: "a category",
        expected: categoryIds.length,
        found: this.prisma.category.count({
          where: { id: { in: categoryIds }, spaceId, deletedAt: null },
        }),
      },
      {
        label: "a tag",
        expected: tagIds.length,
        found: this.prisma.tag.count({
          where: { id: { in: tagIds }, spaceId, deletedAt: null },
        }),
      },
      {
        label: "an author",
        expected: authorIds.length,
        found: this.prisma.author.count({
          where: { id: { in: authorIds }, spaceId, deletedAt: null },
        }),
      },
    ];

    const results = await Promise.all(checks.map((check) => check.found));
    const missing = checks.filter(
      (check, index) => results[index] !== check.expected,
    );
    if (missing.length)
      throw new BadRequestException(
        `The body embeds ${missing.map((check) => check.label).join(", ")} that does not exist, is in the Trash, or is not in this Space`,
      );
  }

  /**
   * A Blog's author, reviewer, category and tags all have to live in the same Space, or the Space
   * stops being self-contained and a clone would carry a dangling reference out of it.
   */
  private async assertReferencesInSpace(
    spaceId: Blog["spaceId"],
    args: BlogReferences,
  ) {
    const authorIds = [args.authorId, args.reviewerId].filter(
      (id): id is string => Boolean(id),
    );

    const [authors, category, tags] = await Promise.all([
      authorIds.length
        ? this.prisma.author.count({
            where: { id: { in: authorIds }, spaceId },
          })
        : 0,
      args.categoryId
        ? this.prisma.category.count({
            where: { id: args.categoryId, spaceId },
          })
        : 0,
      args.tagIds?.length
        ? this.prisma.tag.count({ where: { id: { in: args.tagIds }, spaceId } })
        : 0,
    ]);

    if (authors !== authorIds.length)
      throw new BadRequestException(
        "The author or reviewer no longer exists, or is not in this Space",
      );
    if (args.categoryId && category === 0)
      throw new BadRequestException(
        "That category no longer exists, or is not in this Space",
      );
    if (args.tagIds?.length && tags !== args.tagIds.length)
      throw new BadRequestException(
        "One of those tags no longer exists, or is not in this Space",
      );
  }

  /** Blog slugs are unique per Space *and language*, unlike Category and Tag. */
  private async assertSlugAvailable(
    spaceId: Blog["spaceId"],
    languageCode: SiteLanguage["code"],
    slug: BlogLocale["slug"],
    excludeBlogId?: Blog["id"],
  ) {
    const holder = await this.prisma.blogLocale.findFirst({
      where: {
        spaceId,
        languageCode,
        slug,
        ...(excludeBlogId ? { blogId: { not: excludeBlogId } } : {}),
      },
      include: { blog: true },
    });

    assertSlugFree(
      slug,
      holder && {
        id: holder.blogId,
        title: holder.title,
        deletedAt: holder.blog.deletedAt,
      },
      "post",
    );
  }
}
