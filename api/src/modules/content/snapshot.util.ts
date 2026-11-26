import type {
  Author,
  AuthorLocale,
  Blog,
  BlogLocale,
  BlogTag,
  Category,
  CategoryLocale,
  Cta,
  CtaLocale,
  Tag,
  TagLocale,
} from "@loom/database";

/**
 * What one version records: a locale's own fields plus, under `canonical`, the shared fields it was
 * saved against. The snapshot at `publishedRevision` is what the website serves for that locale,
 * canonical block included — so a Writer's edit to the author or the image changes nothing live
 * until someone publishes it, exactly as an edit to the text does.
 *
 * The Space clone writes versions too, and builds them here, so the two cannot disagree on shape.
 */

/**
 * What a translation was made from — its source revision and per-field baseline. Recorded in every
 * version so a restore brings back the text *and* what it was translated from; otherwise an old
 * translation would come back claiming to be as current as the one it replaced.
 */
const provenanceOf = (
  locale: Pick<BlogLocale, "sourceRevision" | "sourceBaseline">,
) => ({
  sourceRevision: locale.sourceRevision,
  sourceBaseline: locale.sourceBaseline,
});

export type SnapshotProvenance = ReturnType<typeof provenanceOf>;

export type BlogCanonical = Pick<
  Blog,
  "authorId" | "reviewerId" | "categoryId" | "imageId"
> & { tagIds: BlogTag["tagId"][] };

export const blogSnapshot = (
  locale: Pick<
    BlogLocale,
    | "title"
    | "description"
    | "slug"
    | "summary"
    | "updateNote"
    | "body"
    | "faq"
    | "sourceRevision"
    | "sourceBaseline"
  >,
  canonical: BlogCanonical,
) => ({
  title: locale.title,
  description: locale.description,
  slug: locale.slug,
  summary: locale.summary,
  updateNote: locale.updateNote,
  body: locale.body,
  faq: locale.faq,
  provenance: provenanceOf(locale),
  canonical: {
    authorId: canonical.authorId,
    reviewerId: canonical.reviewerId,
    categoryId: canonical.categoryId,
    imageId: canonical.imageId,
    tagIds: canonical.tagIds,
  },
});

export const categorySnapshot = (
  locale: Pick<
    CategoryLocale,
    | "title"
    | "description"
    | "seoMetaTitle"
    | "seoMetaDescription"
    | "sourceRevision"
    | "sourceBaseline"
  >,
  canonical: Pick<
    Category,
    "slug" | "gameCode" | "featuredImageId" | "featureIconId" | "gameCoverId"
  >,
) => ({
  title: locale.title,
  description: locale.description,
  seoMetaTitle: locale.seoMetaTitle,
  seoMetaDescription: locale.seoMetaDescription,
  provenance: provenanceOf(locale),
  canonical: {
    slug: canonical.slug,
    gameCode: canonical.gameCode,
    featuredImageId: canonical.featuredImageId,
    featureIconId: canonical.featureIconId,
    gameCoverId: canonical.gameCoverId,
  },
});

export const tagSnapshot = (
  locale: Pick<
    TagLocale,
    "title" | "description" | "sourceRevision" | "sourceBaseline"
  >,
  canonical: Pick<Tag, "slug" | "featuredImageId">,
) => ({
  title: locale.title,
  description: locale.description,
  provenance: provenanceOf(locale),
  canonical: {
    slug: canonical.slug,
    featuredImageId: canonical.featuredImageId,
  },
});

export const authorSnapshot = (
  locale: Pick<
    AuthorLocale,
    "jobTitle" | "bio" | "sourceRevision" | "sourceBaseline"
  >,
  canonical: Pick<Author, "name" | "profileImageId" | "socialLinks">,
) => ({
  jobTitle: locale.jobTitle,
  bio: locale.bio,
  provenance: provenanceOf(locale),
  canonical: {
    name: canonical.name,
    profileImageId: canonical.profileImageId,
    socialLinks: canonical.socialLinks,
  },
});

export const ctaSnapshot = (
  locale: Pick<
    CtaLocale,
    | "title"
    | "description"
    | "buttonLabel"
    | "sourceRevision"
    | "sourceBaseline"
  >,
  canonical: Pick<Cta, "url" | "cmpid" | "imageId">,
) => ({
  title: locale.title,
  description: locale.description,
  buttonLabel: locale.buttonLabel,
  provenance: provenanceOf(locale),
  canonical: {
    url: canonical.url,
    cmpid: canonical.cmpid,
    imageId: canonical.imageId,
  },
});

/** The list is ordered references with no text, and nothing canonical of its own. */
export const featuredArticlesSnapshot = (items: Blog["id"][]) => ({ items });

export type BlogSnapshot = ReturnType<typeof blogSnapshot>;
export type CategorySnapshot = ReturnType<typeof categorySnapshot>;
export type TagSnapshot = ReturnType<typeof tagSnapshot>;
export type AuthorSnapshot = ReturnType<typeof authorSnapshot>;
export type CtaSnapshot = ReturnType<typeof ctaSnapshot>;
export type FeaturedArticlesSnapshot = ReturnType<
  typeof featuredArticlesSnapshot
>;
