import {
  type Author,
  type Category,
  CmsContentType,
  type Cta,
  type Media,
  type Prisma,
  type Site,
  type Space,
  type Tag,
} from "@loom/database";
import type {
  DeliveryAuthorResponseDto,
  DeliveryBlogListRequestDto,
  DeliveryBlogListResponseDto,
  DeliveryBlogResponseDto,
  DeliveryBlogSummaryResponseDto,
  DeliveryCategoryDetailResponseDto,
  DeliveryCategoryResponseDto,
  DeliveryCtaResponseDto,
  DeliveryEntryLinkResponseDto,
  DeliveryFaqItemResponseDto,
  DeliveryFeaturedArticlesResponseDto,
  DeliveryMediaResponseDto,
  DeliveryTagDetailResponseDto,
  DeliveryTagResponseDto,
} from "@loom/dto";
import {
  LIST_DEFAULT_PAGE_SIZE,
  type RichTextEntryType,
} from "@loom/dto/constants";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  collectReferences,
  type RichTextNode,
} from "../content/rich-text.util";
import type { BlogSnapshot } from "../content/snapshot.util";
import { S3Service } from "../media/s3.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  type BlogFilter,
  type BlogSummarySnapshot,
  LiveContentService,
  type LiveItem,
  type LiveScope,
} from "./live-content.service";

/** A request's Space and language, and the other languages alternates may name. */
export interface DeliveryScope extends LiveScope {
  otherLanguages: Site["defaultLanguage"][];
}

const SPACE_WITH_LANGUAGES = {
  site: { include: { languages: true } },
} as const satisfies Prisma.SpaceInclude;

type MaybeId = string | null | undefined;

/** How a "not found" puts it: nothing live, or in preview, nothing saved. */
const served = (scope: Pick<LiveScope, "preview">) =>
  scope.preview ? "saved" : "live";

const present = (ids: MaybeId[]) => [
  ...new Set(ids.filter((id): id is string => Boolean(id))),
];

/**
 * The Content API: read-only, live content only, one language per response. What was
 * asked for is served in that language or not at all; what it refers to — a byline, a category, an
 * embed — falls back to the default language rather than disappearing, and says which it is.
 * Anything no longer live is absent.
 */
@Injectable()
export class DeliveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly live: LiveContentService,
    private readonly s3: S3Service,
  ) {}

  /** `preview` is the controller's to allow: only an API key that may read drafts gets it. */
  async scope(
    siteSlug: Site["slug"],
    spaceSlug: Space["slug"],
    locale: Site["defaultLanguage"],
    preview = false,
  ): Promise<DeliveryScope> {
    const space = await this.prisma.space.findFirst({
      where: { slug: spaceSlug, site: { slug: siteSlug } },
      include: SPACE_WITH_LANGUAGES,
    });
    if (!space)
      throw new NotFoundException(`${siteSlug} has no Space ${spaceSlug}`);
    return this.scopeOf(space, locale, preview);
  }

  /** The same scope, for the admin's own preview, which knows the item's Space by id. */
  async scopeForSpace(
    spaceId: Space["id"],
    locale: Site["defaultLanguage"],
    preview: boolean,
  ): Promise<DeliveryScope> {
    const space = await this.prisma.space.findUniqueOrThrow({
      where: { id: spaceId },
      include: SPACE_WITH_LANGUAGES,
    });
    return this.scopeOf(space, locale, preview);
  }

  private scopeOf(
    space: Prisma.SpaceGetPayload<{ include: typeof SPACE_WITH_LANGUAGES }>,
    locale: Site["defaultLanguage"],
    preview: boolean,
  ): DeliveryScope {
    const enabled = space.site.languages
      .filter((language) => language.enabled)
      .map((language) => language.code);
    if (!enabled.includes(locale))
      throw new BadRequestException(
        `${locale} is not a language on ${space.site.name}`,
      );

    return {
      spaceId: space.id,
      languageCode: locale,
      defaultLanguage: space.site.defaultLanguage,
      fallback: true,
      preview,
      otherLanguages: enabled.filter((code) => code !== locale),
    };
  }

  async listBlogs(
    scope: DeliveryScope,
    query: DeliveryBlogListRequestDto,
  ): Promise<DeliveryBlogListResponseDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? LIST_DEFAULT_PAGE_SIZE;
    const [categoryId, tagId] = await Promise.all([
      query.category
        ? this.idBySlug(CmsContentType.CATEGORY, scope, query.category)
        : undefined,
      query.tag
        ? this.idBySlug(CmsContentType.TAG, scope, query.tag)
        : undefined,
    ]);

    const { items, total } = await this.live.blogs(
      scope,
      { categoryId, tagId, authorId: query.author },
      { skip: (page - 1) * pageSize, take: pageSize },
    );
    return {
      items: await this.summaries(scope, items),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getBlog(
    scope: DeliveryScope,
    slug: string,
  ): Promise<DeliveryBlogResponseDto> {
    return this.composeBlog(scope, await this.live.blog(scope, slug));
  }

  /** One post by id — the admin preview's way in, since a draft's slug need not be unique yet. */
  async getBlogById(
    scope: DeliveryScope,
    id: string,
  ): Promise<DeliveryBlogResponseDto> {
    return this.composeBlog(scope, await this.live.blogById(scope, id));
  }

  /** Every published post shown in one place, for a category, tag or author page. */
  async postsWhere(
    scope: DeliveryScope,
    filter: Pick<BlogFilter, "categoryId" | "tagId" | "authorId">,
    take: number,
  ): Promise<DeliveryBlogSummaryResponseDto[]> {
    const { items } = await this.live.blogs(scope, filter, { skip: 0, take });
    return this.summaries(scope, items);
  }

  /** A post with everything it refers to resolved, however it was found. */
  private async composeBlog(
    scope: DeliveryScope,
    post: LiveItem<BlogSnapshot>,
  ): Promise<DeliveryBlogResponseDto> {
    const { canonical } = post.snapshot;
    const body = post.snapshot.body as unknown as RichTextNode;
    const references = collectReferences(body);

    const [[summary], people, tags, ctas, media, entries, alternates] =
      await Promise.all([
        this.summaries(scope, [post]),
        this.authors(scope, [canonical.reviewerId]),
        this.tags(scope, canonical.tagIds),
        this.ctas(scope, [...references.ctaIds]),
        this.media([...references.mediaIds]),
        this.entries(scope, references.entries),
        this.live.blogAlternates(post.id, scope.otherLanguages, scope.preview),
      ]);

    return {
      ...summary,
      summary: post.snapshot.summary,
      updateNote: post.snapshot.updateNote,
      body: post.snapshot.body as unknown as Record<string, unknown>,
      faq: post.snapshot.faq as unknown as DeliveryFaqItemResponseDto[],
      reviewer: canonical.reviewerId
        ? (people.get(canonical.reviewerId) ?? null)
        : null,
      tags: canonical.tagIds.flatMap((id) => tags.get(id) ?? []),
      alternates,
      includes: {
        media: [...media.values()],
        ctas: [...ctas.values()],
        entries,
      },
    };
  }

  async listCategories(
    scope: DeliveryScope,
  ): Promise<DeliveryCategoryResponseDto[]> {
    const categories = await this.categories({ ...scope, fallback: false });
    return [...categories.values()].sort((a, b) =>
      a.title.localeCompare(b.title, scope.languageCode),
    );
  }

  async getCategory(
    scope: DeliveryScope,
    slug: Category["slug"],
  ): Promise<DeliveryCategoryDetailResponseDto> {
    const category = [
      ...(await this.categories({ ...scope, fallback: false })).values(),
    ].find((candidate) => candidate.slug === slug);
    if (!category)
      throw new NotFoundException(
        `No category is ${served(scope)} at ${slug} in ${scope.languageCode}`,
      );
    return this.categoryDetail(scope, category);
  }

  async getCategoryById(
    scope: DeliveryScope,
    id: Category["id"],
  ): Promise<DeliveryCategoryDetailResponseDto> {
    const category = (
      await this.categories({ ...scope, fallback: false }, [id])
    ).get(id);
    if (!category)
      throw new NotFoundException(
        `This category has no ${served(scope)} ${scope.languageCode} version`,
      );
    return this.categoryDetail(scope, category);
  }

  private async categoryDetail(
    scope: DeliveryScope,
    category: DeliveryCategoryResponseDto,
  ): Promise<DeliveryCategoryDetailResponseDto> {
    return {
      ...category,
      alternates: await this.sharedSlugAlternates(
        CmsContentType.CATEGORY,
        category,
        scope,
      ),
    };
  }

  async listTags(scope: DeliveryScope): Promise<DeliveryTagResponseDto[]> {
    const tags = await this.tags({ ...scope, fallback: false });
    return [...tags.values()].sort((a, b) =>
      a.title.localeCompare(b.title, scope.languageCode),
    );
  }

  async getTag(
    scope: DeliveryScope,
    slug: Tag["slug"],
  ): Promise<DeliveryTagDetailResponseDto> {
    const tag = [
      ...(await this.tags({ ...scope, fallback: false })).values(),
    ].find((candidate) => candidate.slug === slug);
    if (!tag)
      throw new NotFoundException(
        `No tag is ${served(scope)} at ${slug} in ${scope.languageCode}`,
      );
    return this.tagDetail(scope, tag);
  }

  async getTagById(
    scope: DeliveryScope,
    id: Tag["id"],
  ): Promise<DeliveryTagDetailResponseDto> {
    const tag = (await this.tags({ ...scope, fallback: false }, [id])).get(id);
    if (!tag)
      throw new NotFoundException(
        `This tag has no ${served(scope)} ${scope.languageCode} version`,
      );
    return this.tagDetail(scope, tag);
  }

  private async tagDetail(
    scope: DeliveryScope,
    tag: DeliveryTagResponseDto,
  ): Promise<DeliveryTagDetailResponseDto> {
    return {
      ...tag,
      alternates: await this.sharedSlugAlternates(
        CmsContentType.TAG,
        tag,
        scope,
      ),
    };
  }

  async listAuthors(
    scope: DeliveryScope,
  ): Promise<DeliveryAuthorResponseDto[]> {
    const authors = await this.authors({ ...scope, fallback: false });
    return [...authors.values()].sort((a, b) =>
      a.name.localeCompare(b.name, scope.languageCode),
    );
  }

  async getAuthor(
    scope: DeliveryScope,
    authorId: Author["id"],
  ): Promise<DeliveryAuthorResponseDto> {
    const author = (
      await this.authors({ ...scope, fallback: false }, [authorId])
    ).get(authorId);
    if (!author)
      throw new NotFoundException(
        `No author ${authorId} is ${served(scope)} in ${scope.languageCode}`,
      );
    return author;
  }

  /** The list in its order, keeping the posts live in this language. Not live here: an empty list. */
  async getFeaturedArticles(
    scope: DeliveryScope,
  ): Promise<DeliveryFeaturedArticlesResponseDto> {
    const [list] = [
      ...(
        await this.live.items(CmsContentType.FEATURED_ARTICLES, {
          ...scope,
          fallback: false,
        })
      ).values(),
    ];
    if (!list) return { items: [] };

    const { items } = await this.live.blogs(scope, {
      ids: list.snapshot.items,
    });
    const byId = new Map(items.map((item) => [item.id, item]));
    return {
      items: await this.summaries(
        scope,
        list.snapshot.items.flatMap((id) => byId.get(id) ?? []),
      ),
    };
  }

  private async summaries(
    scope: DeliveryScope,
    posts: LiveItem<BlogSummarySnapshot>[],
  ): Promise<DeliveryBlogSummaryResponseDto[]> {
    const canonicals = posts.map((post) => post.snapshot.canonical);
    const [authors, categories, media] = await Promise.all([
      this.authors(
        scope,
        canonicals.map((canonical) => canonical.authorId),
      ),
      this.categories(
        scope,
        canonicals.map((canonical) => canonical.categoryId),
      ),
      this.media(canonicals.map((canonical) => canonical.imageId)),
    ]);

    return posts.map(
      ({ id, languageCode, firstPublishedAt, publishedAt, snapshot }) => ({
        id,
        languageCode,
        slug: snapshot.slug,
        title: snapshot.title,
        description: snapshot.description,
        firstPublishedAt,
        publishedAt,
        image: this.pick(media, snapshot.canonical.imageId),
        author: this.pick(authors, snapshot.canonical.authorId),
        category: this.pick(categories, snapshot.canonical.categoryId),
      }),
    );
  }

  /** Every item when `ids` is absent, else just those (a reference's missing id is skipped). */
  private async authors(
    scope: LiveScope,
    ids?: MaybeId[],
  ): Promise<Map<Author["id"], DeliveryAuthorResponseDto>> {
    const live = await this.live.items(
      CmsContentType.AUTHOR,
      scope,
      ids && present(ids),
    );
    const media = await this.media(
      [...live.values()].map((item) => item.snapshot.canonical.profileImageId),
    );
    return new Map(
      [...live.values()].map(({ id, languageCode, snapshot }) => [
        id,
        {
          id,
          languageCode,
          name: snapshot.canonical.name,
          jobTitle: snapshot.jobTitle,
          bio: snapshot.bio,
          socialLinks: snapshot.canonical.socialLinks,
          profileImage: this.pick(media, snapshot.canonical.profileImageId),
        },
      ]),
    );
  }

  private async categories(
    scope: LiveScope,
    ids?: MaybeId[],
  ): Promise<Map<Category["id"], DeliveryCategoryResponseDto>> {
    const live = await this.live.items(
      CmsContentType.CATEGORY,
      scope,
      ids && present(ids),
    );
    const canonicals = [...live.values()].map(
      (item) => item.snapshot.canonical,
    );
    const media = await this.media(
      canonicals.flatMap((canonical) => [
        canonical.featuredImageId,
        canonical.featureIconId,
        canonical.gameCoverId,
      ]),
    );
    return new Map(
      [...live.values()].map(({ id, languageCode, snapshot }) => [
        id,
        {
          id,
          languageCode,
          slug: snapshot.canonical.slug,
          gameCode: snapshot.canonical.gameCode,
          title: snapshot.title,
          description: snapshot.description,
          seoMetaTitle: snapshot.seoMetaTitle,
          seoMetaDescription: snapshot.seoMetaDescription,
          featuredImage: this.pick(media, snapshot.canonical.featuredImageId),
          featureIcon: this.pick(media, snapshot.canonical.featureIconId),
          gameCover: this.pick(media, snapshot.canonical.gameCoverId),
        },
      ]),
    );
  }

  private async tags(
    scope: LiveScope,
    ids?: MaybeId[],
  ): Promise<Map<Tag["id"], DeliveryTagResponseDto>> {
    const live = await this.live.items(
      CmsContentType.TAG,
      scope,
      ids && present(ids),
    );
    const media = await this.media(
      [...live.values()].map((item) => item.snapshot.canonical.featuredImageId),
    );
    return new Map(
      [...live.values()].map(({ id, languageCode, snapshot }) => [
        id,
        {
          id,
          languageCode,
          slug: snapshot.canonical.slug,
          title: snapshot.title,
          description: snapshot.description,
          featuredImage: this.pick(media, snapshot.canonical.featuredImageId),
        },
      ]),
    );
  }

  private async ctas(
    scope: LiveScope,
    ids: Cta["id"][],
  ): Promise<Map<Cta["id"], DeliveryCtaResponseDto>> {
    if (!ids.length) return new Map();
    const live = await this.live.items(CmsContentType.CTA, scope, ids);
    const media = await this.media(
      [...live.values()].map((item) => item.snapshot.canonical.imageId),
    );
    return new Map(
      [...live.values()].map(({ id, languageCode, snapshot }) => [
        id,
        {
          id,
          languageCode,
          title: snapshot.title,
          description: snapshot.description,
          buttonLabel: snapshot.buttonLabel,
          url: snapshot.canonical.url,
          cmpid: snapshot.canonical.cmpid,
          image: this.pick(media, snapshot.canonical.imageId),
        },
      ]),
    );
  }

  /** Where each entry link in a body points, in this language or the default one. */
  private async entries(
    scope: DeliveryScope,
    references: { type: RichTextEntryType; id: string }[],
  ): Promise<DeliveryEntryLinkResponseDto[]> {
    const idsOf = (type: RichTextEntryType) =>
      present(
        references.filter((ref) => ref.type === type).map((ref) => ref.id),
      );
    const [blogs, categories, tags, authors] = await Promise.all([
      this.live.blogsWithFallback(scope, idsOf("blog")),
      idsOf("category").length
        ? this.categories(scope, idsOf("category"))
        : new Map<Category["id"], DeliveryCategoryResponseDto>(),
      idsOf("tag").length
        ? this.tags(scope, idsOf("tag"))
        : new Map<Tag["id"], DeliveryTagResponseDto>(),
      idsOf("author").length
        ? this.authors(scope, idsOf("author"))
        : new Map<Author["id"], DeliveryAuthorResponseDto>(),
    ]);

    return [
      ...[...blogs.values()].map((post) => ({
        type: "blog" as const,
        id: post.id,
        languageCode: post.languageCode,
        slug: post.snapshot.slug,
        title: post.snapshot.title,
      })),
      ...[...categories.values()].map((category) => ({
        type: "category" as const,
        id: category.id,
        languageCode: category.languageCode,
        slug: category.slug,
        title: category.title,
      })),
      ...[...tags.values()].map((tag) => ({
        type: "tag" as const,
        id: tag.id,
        languageCode: tag.languageCode,
        slug: tag.slug,
        title: tag.title,
      })),
      ...[...authors.values()].map((author) => ({
        type: "author" as const,
        id: author.id,
        languageCode: author.languageCode,
        slug: null,
        title: author.name,
      })),
    ];
  }

  /** Images stay servable after they leave the library, so deleted ones are included. */
  private async media(
    ids: MaybeId[],
  ): Promise<Map<Media["id"], DeliveryMediaResponseDto>> {
    const wanted = present(ids);
    if (!wanted.length) return new Map();
    const rows = await this.prisma.media.findMany({
      where: { id: { in: wanted } },
    });
    return new Map(
      rows.map((media) => [
        media.id,
        {
          id: media.id,
          url: this.s3.publicUrlOf(media.s3Key),
          altText: media.altText,
          mimeType: media.mimeType,
          width: media.width,
          height: media.height,
        },
      ]),
    );
  }

  /** A category's or tag's slug is shared, so every language serves it at the same one. */
  private async sharedSlugAlternates(
    type: CmsContentType,
    item: { id: string; slug: string },
    scope: DeliveryScope,
  ) {
    const languages = await this.live.liveLanguages(
      type,
      item.id,
      scope.otherLanguages,
      scope.preview,
    );
    return languages.map((languageCode) => ({ languageCode, slug: item.slug }));
  }

  /** The id of the category or tag live at a slug, in any language — the filter is by identity. */
  private async idBySlug(
    type: typeof CmsContentType.CATEGORY | typeof CmsContentType.TAG,
    scope: LiveScope,
    slug: string,
  ): Promise<Category["id"]> {
    const live = await this.live.items(type, scope);
    const match = [...live.values()].find(
      (item) => item.snapshot.canonical.slug === slug,
    );
    if (!match)
      throw new NotFoundException(
        `No ${type === CmsContentType.CATEGORY ? "category" : "tag"} is ${served(scope)} at ${slug}`,
      );
    return match.id;
  }

  private pick<T>(map: Map<string, T>, id: MaybeId): T | null {
    return id ? (map.get(id) ?? null) : null;
  }
}
