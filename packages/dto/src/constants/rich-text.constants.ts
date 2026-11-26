/**
 * The post-body document contract, in the values that are plain data. Which node and
 * mark types exist, and how they nest, is the schema itself (`@loom/dto/rich-text`), which
 * the editor is built from and the API parses with, so there is no list here to drift from it.
 *
 * Bodies are stored as Tiptap/ProseMirror JSON, never rendered HTML.
 */

/** Node types that carry a reference to another record, by the attribute holding the id. */
export const RICH_TEXT_REFERENCE_NODES = {
  // The embed family is shaped so more types slot in
  ctaEmbed: "ctaId",
  mediaEmbed: "mediaId",
  entryEmbed: "entryId",
  entryInline: "entryId",
} as const;

/** Marks that carry a reference, by the attribute holding the id. */
export const RICH_TEXT_REFERENCE_MARKS = {
  entryLink: "entryId",
  assetLink: "mediaId",
} as const;

/** The content types an entry embed, inline entry or entry link may point at. */
export const RICH_TEXT_ENTRY_TYPES = [
  "blog",
  "category",
  "tag",
  "author",
] as const;

export type RichTextEntryType = (typeof RICH_TEXT_ENTRY_TYPES)[number];

export const RICH_TEXT_HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const;

// A body is edited in one request; this is a ceiling against a runaway paste, not a style rule
export const RICH_TEXT_MAX_BYTES = 2 * 1024 * 1024;

// A table cell spanning more than this is a mistake or an attack on the renderer, not a layout
export const RICH_TEXT_TABLE_MAX_SPAN = 50;

// Pixels. Column widths are only ever set by resizing, which the editor does not offer
export const RICH_TEXT_TABLE_MAX_COLUMN_WIDTH = 4000;

// The rel every link is stored with — fixed, so a document cannot set its own
export const RICH_TEXT_LINK_REL = "noopener noreferrer nofollow";

// A link is rendered straight into a published page, so only schemes that cannot run script
const SAFE_LINK_PROTOCOLS = new Set(["https:", "http:", "mailto:"]);

/**
 * Whether a link target is safe to publish: an http(s) or mailto URL, a site-relative path, or an
 * in-page anchor. Anything else — javascript:, data:, a protocol-relative //host — is refused.
 */
export function isSafeHref(href: string): boolean {
  const value = href.trim();
  // A URL parser deletes tabs and newlines before reading the URL, so "/\t/evil.com" reaches the
  // browser as "//evil.com". Anything a parser would rewrite is refused rather than second-guessed.
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code < 0x20 || code === 0x7f) return false;
  }
  if (value.startsWith("#")) return true;
  if (value.startsWith("/")) return !/^\/[/\\]/.test(value);
  try {
    return SAFE_LINK_PROTOCOLS.has(new URL(value).protocol);
  } catch {
    return false;
  }
}
