import type { CmsContentType } from "@loom/database";

/**
 * The types with a page of their own on a website, so something to preview, and the name each is
 * given in a resolved Preview link — the same names entry links use in a post's `includes`. A CTA
 * and the Featured Articles list only ever appear inside other pages.
 */
export const PREVIEWABLE_TYPES = {
  BLOG: "blog",
  CATEGORY: "category",
  TAG: "tag",
  AUTHOR: "author",
} as const satisfies Partial<Record<CmsContentType, string>>;

export type PreviewableContentType = keyof typeof PREVIEWABLE_TYPES;
export type PreviewableType =
  (typeof PREVIEWABLE_TYPES)[PreviewableContentType];

export const isPreviewable = (
  type: CmsContentType,
): type is PreviewableContentType => type in PREVIEWABLE_TYPES;

/**
 * How long a Preview link resolves. It only has to survive the click: once the website has turned
 * draft mode on, it no longer needs the token. A link that leaks is a window onto every draft, so
 * keep it short.
 */
export const PREVIEW_LINK_TTL_MS = 60 * 60 * 1000;
