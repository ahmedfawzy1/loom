import type { BlogLocale, CmsContentType } from "@loom/database";

/**
 * The URL segment each content type is addressed by. The API's workflow routes take it as `:type`,
 * and the web app's query keys are rooted on it, so one list keeps both in step.
 */
export const CONTENT_TYPE_PATHS = {
  BLOG: "blogs",
  CATEGORY: "categories",
  TAG: "tags",
  AUTHOR: "authors",
  CTA: "ctas",
  FEATURED_ARTICLES: "featured-articles",
} as const satisfies Record<CmsContentType, string>;

export type ContentTypePath = (typeof CONTENT_TYPE_PATHS)[CmsContentType];

/** How a content type is named to a person — the review queue and the Trash list mix all of them. */
export const CONTENT_TYPE_LABELS = {
  BLOG: "Post",
  CATEGORY: "Category",
  TAG: "Tag",
  AUTHOR: "Author",
  CTA: "CTA",
  FEATURED_ARTICLES: "Featured articles",
} as const satisfies Record<CmsContentType, string>;

// A reviewer's note is guidance for one round of changes, not content
export const REVIEW_NOTE_MAX_LENGTH = 2000;

/**
 * Where a language stands against its source:
 * - `source` — it is the source language, or there is no source to compare with.
 * - `untracked` — nothing records what it was made from: written before the CMS tracked
 *   translations, or imported. Never shown as up to date, since nobody knows whether it is.
 * - `stale` — made from, or confirmed against, a source whose text has changed since.
 * - `current` — made from, or confirmed against, the source as it is now.
 * Shared so the API and the editor agree.
 */
export type TranslationState = "source" | "untracked" | "stale" | "current";

export function translationState(
  locale: Pick<BlogLocale, "languageCode" | "sourceRevision">,
  source: Pick<BlogLocale, "languageCode" | "contentRevision"> | undefined,
): TranslationState {
  if (!source || locale.languageCode === source.languageCode) return "source";
  if (locale.sourceRevision === null) return "untracked";
  return locale.sourceRevision < source.contentRevision ? "stale" : "current";
}

/**
 * What a bulk action can do. Translating in bulk is the single-item translate run once
 * per item by the client, so each item reports as it finishes rather than after a very long request.
 */
export const BULK_ACTIONS = [
  "publish",
  "unpublish",
  "submit",
  "trash",
  "restore",
] as const;
export type BulkAction = (typeof BULK_ACTIONS)[number];
