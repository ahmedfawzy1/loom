import { CmsContentType, type Prisma } from "@loom/database";
import {
  AUTHOR_BIO_MAX_LENGTH,
  AUTHOR_JOB_TITLE_MAX_LENGTH,
  BLOG_DESCRIPTION_MAX_LENGTH,
  BLOG_SUMMARY_MAX_LENGTH,
  BLOG_TITLE_MAX_LENGTH,
  BLOG_UPDATE_NOTE_MAX_LENGTH,
  CATEGORY_DESCRIPTION_MAX_LENGTH,
  CATEGORY_SEO_DESCRIPTION_MAX_LENGTH,
  CATEGORY_SEO_TITLE_MAX_LENGTH,
  CTA_BUTTON_LABEL_MAX_LENGTH,
  CTA_DESCRIPTION_MAX_LENGTH,
  CTA_TITLE_MAX_LENGTH,
  TAG_DESCRIPTION_MAX_LENGTH,
  TAG_TITLE_MAX_LENGTH,
} from "@loom/dto/constants";

/**
 * The minimum every canonical/locale delegate is used through. Prisma's generated delegates are
 * each a distinct type with no common supertype, so a registry over all six needs a structural
 * interface — but a narrow one, not `any`: every call site still goes through these signatures.
 */
export interface ContentDelegate<TRow = unknown> {
  findMany(args: {
    where?: unknown;
    select?: unknown;
    include?: unknown;
    orderBy?: unknown;
    skip?: number;
    take?: number;
  }): Promise<TRow[]>;
  findFirst(args: {
    where?: unknown;
    select?: unknown;
    include?: unknown;
  }): Promise<TRow | null>;
  findUnique(args: { where: unknown; select?: unknown }): Promise<TRow | null>;
  count(args: { where?: unknown }): Promise<number>;
  create(args: { data: unknown }): Promise<TRow>;
  update(args: { where: unknown; data: unknown }): Promise<TRow>;
  updateMany(args: {
    where: unknown;
    data: unknown;
  }): Promise<{ count: number }>;
  delete(args: { where: unknown }): Promise<TRow>;
}

type AnyClient = Prisma.TransactionClient;

/** A locale field DeepL translates: its shape, and the length the result has to fit. */
export interface TranslatedField {
  name: string;
  kind: "text" | "richText" | "faq";
  /** What the field is, for DeepL's context. */
  label: string;
  /** A save would refuse anything longer, so the translation is fitted to it. */
  maxLength?: number;
}

export interface TranslationSpec {
  translated: TranslatedField[];
  /** Locale fields copied verbatim from the source language rather than translated. */
  copied: string[];
  /** A new language's slug is the source slug, translated — once, never again. */
  translatesSlug: boolean;
}

/** Where a type's slug lives, which decides what uniqueness means for it. */
export type SlugScope = "canonical" | "locale" | "none";

export interface ContentKind {
  /** The canonical table — identity, relations, soft delete. */
  canonical: (client: AnyClient) => ContentDelegate;
  /** The per-language table — text, publish state, revision. */
  locale: (client: AnyClient) => ContentDelegate;
  /** The immutable per-save snapshots. */
  version: (client: AnyClient) => ContentDelegate;
  /** The foreign key on the locale row pointing back at the canonical one. */
  localeForeignKey: string;
  /** The relation on the locale row that reaches the canonical one, for queries that start there. */
  canonicalRelation: string;
  /** The locale table's SQL name, for the row lock a save takes (see VersionService.commit). */
  localeTable: string;
  /** The canonical table's SQL name, which a save stamps as edited (see VersionService.commit). */
  canonicalTable: string;
  /** The foreign key on the version row pointing back at the locale. */
  versionForeignKey: string;
  slugScope: SlugScope;
  /** Locale columns a list search matches against. */
  searchableLocaleFields: string[];
  /** Canonical columns a list search matches against, for identity that is not on the locale row. */
  searchableCanonicalFields?: string[];
  /** How a language is made from the source one. Absent for a type with no text. */
  translation?: TranslationSpec;
  /** The locale column a list row shows as its title. */
  titleField: string;
  /**
   * A canonical column to show instead, when identity does not live on the locale row. Author is
   * the case: `name` is canonical so a byline does not drift between languages, which
   * means the locale row holds only a job title and a bio — neither of which identifies anybody.
   */
  canonicalTitleField?: string;
}

/**
 * Describes each content type once. Six types times CRUD, versioning, publishing, trash, duplicate
 * and translation is the repetition that forces this: without it the same publish transaction gets
 * written six times and drifts.
 */
export const CONTENT_KINDS: Record<CmsContentType, ContentKind> = {
  [CmsContentType.BLOG]: {
    canonical: (client) => client.blog as unknown as ContentDelegate,
    locale: (client) => client.blogLocale as unknown as ContentDelegate,
    version: (client) => client.blogVersion as unknown as ContentDelegate,
    localeForeignKey: "blogId",
    canonicalRelation: "blog",
    localeTable: "BlogLocale",
    canonicalTable: "Blog",
    versionForeignKey: "blogLocaleId",
    slugScope: "locale",
    searchableLocaleFields: ["title", "description", "slug", "summary"],
    translation: {
      translated: [
        {
          name: "title",
          kind: "text",
          label: "blog post title",
          maxLength: BLOG_TITLE_MAX_LENGTH,
        },
        {
          name: "description",
          kind: "text",
          label: "blog post description",
          maxLength: BLOG_DESCRIPTION_MAX_LENGTH,
        },
        {
          name: "summary",
          kind: "text",
          label: "blog post summary",
          maxLength: BLOG_SUMMARY_MAX_LENGTH,
        },
        {
          name: "updateNote",
          kind: "text",
          label: "blog post update note",
          maxLength: BLOG_UPDATE_NOTE_MAX_LENGTH,
        },
        { name: "body", kind: "richText", label: "blog post body" },
        { name: "faq", kind: "faq", label: "blog post FAQ" },
      ],
      copied: [],
      translatesSlug: true,
    },
    titleField: "title",
  },

  [CmsContentType.CATEGORY]: {
    canonical: (client) => client.category as unknown as ContentDelegate,
    locale: (client) => client.categoryLocale as unknown as ContentDelegate,
    version: (client) => client.categoryVersion as unknown as ContentDelegate,
    localeForeignKey: "categoryId",
    canonicalRelation: "category",
    localeTable: "CategoryLocale",
    canonicalTable: "Category",
    versionForeignKey: "categoryLocaleId",
    slugScope: "canonical",
    searchableLocaleFields: ["title", "description"],
    translation: {
      translated: [
        {
          name: "description",
          kind: "text",
          label: "game category description",
          maxLength: CATEGORY_DESCRIPTION_MAX_LENGTH,
        },
        {
          name: "seoMetaTitle",
          kind: "text",
          label: "SEO page title",
          maxLength: CATEGORY_SEO_TITLE_MAX_LENGTH,
        },
        {
          name: "seoMetaDescription",
          kind: "text",
          label: "SEO meta description",
          maxLength: CATEGORY_SEO_DESCRIPTION_MAX_LENGTH,
        },
      ],
      // A game's name is the same in every language
      copied: ["title"],
      translatesSlug: false,
    },
    titleField: "title",
  },

  [CmsContentType.TAG]: {
    canonical: (client) => client.tag as unknown as ContentDelegate,
    locale: (client) => client.tagLocale as unknown as ContentDelegate,
    version: (client) => client.tagVersion as unknown as ContentDelegate,
    localeForeignKey: "tagId",
    canonicalRelation: "tag",
    localeTable: "TagLocale",
    canonicalTable: "Tag",
    versionForeignKey: "tagLocaleId",
    slugScope: "canonical",
    searchableLocaleFields: ["title", "description"],
    translation: {
      translated: [
        {
          name: "title",
          kind: "text",
          label: "tag name",
          maxLength: TAG_TITLE_MAX_LENGTH,
        },
        {
          name: "description",
          kind: "text",
          label: "tag description",
          maxLength: TAG_DESCRIPTION_MAX_LENGTH,
        },
      ],
      copied: [],
      translatesSlug: false,
    },
    titleField: "title",
  },

  [CmsContentType.AUTHOR]: {
    canonical: (client) => client.author as unknown as ContentDelegate,
    locale: (client) => client.authorLocale as unknown as ContentDelegate,
    version: (client) => client.authorVersion as unknown as ContentDelegate,
    localeForeignKey: "authorId",
    canonicalRelation: "author",
    localeTable: "AuthorLocale",
    canonicalTable: "Author",
    versionForeignKey: "authorLocaleId",
    // Name and social links are canonical, so an Author has no slug of its own
    slugScope: "none",
    searchableLocaleFields: ["jobTitle", "bio"],
    translation: {
      translated: [
        {
          name: "jobTitle",
          kind: "text",
          label: "author job title",
          maxLength: AUTHOR_JOB_TITLE_MAX_LENGTH,
        },
        {
          name: "bio",
          kind: "text",
          label: "author biography",
          maxLength: AUTHOR_BIO_MAX_LENGTH,
        },
      ],
      copied: [],
      translatesSlug: false,
    },
    titleField: "jobTitle",
    canonicalTitleField: "name",
    // Otherwise searching the Authors list by an author's name finds nothing
    searchableCanonicalFields: ["name"],
  },

  [CmsContentType.CTA]: {
    canonical: (client) => client.cta as unknown as ContentDelegate,
    locale: (client) => client.ctaLocale as unknown as ContentDelegate,
    version: (client) => client.ctaVersion as unknown as ContentDelegate,
    localeForeignKey: "ctaId",
    canonicalRelation: "cta",
    localeTable: "CtaLocale",
    canonicalTable: "Cta",
    versionForeignKey: "ctaLocaleId",
    slugScope: "none",
    searchableLocaleFields: ["title", "description", "buttonLabel"],
    translation: {
      translated: [
        {
          name: "title",
          kind: "text",
          label: "call-to-action heading",
          maxLength: CTA_TITLE_MAX_LENGTH,
        },
        {
          name: "description",
          kind: "text",
          label: "call-to-action text",
          maxLength: CTA_DESCRIPTION_MAX_LENGTH,
        },
        {
          name: "buttonLabel",
          kind: "text",
          label: "button label",
          maxLength: CTA_BUTTON_LABEL_MAX_LENGTH,
        },
      ],
      copied: [],
      translatesSlug: false,
    },
    titleField: "title",
  },

  [CmsContentType.FEATURED_ARTICLES]: {
    canonical: (client) =>
      client.featuredArticles as unknown as ContentDelegate,
    locale: (client) =>
      client.featuredArticlesLocale as unknown as ContentDelegate,
    version: (client) =>
      client.featuredArticlesVersion as unknown as ContentDelegate,
    localeForeignKey: "featuredArticlesId",
    canonicalRelation: "featuredArticles",
    localeTable: "FeaturedArticlesLocale",
    canonicalTable: "FeaturedArticles",
    versionForeignKey: "featuredArticlesLocaleId",
    slugScope: "none",
    searchableLocaleFields: [],
    // The list is ordered references, not prose — there is nothing for DeepL to do, so no
    // `translation`: each language keeps its own list
    titleField: "languageCode",
  },
};

export const contentKind = (type: CmsContentType): ContentKind =>
  CONTENT_KINDS[type];
