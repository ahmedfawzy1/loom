// Slug rule shared by Site, Space, Category and Tag. Blog slugs are deliberately exempt: any script
// is allowed there, because a translated slug is written in the target language.
// Deliberately stricter than `^[a-z0-9\-]+$`, which also permits `--`, a leading dash and a
// trailing one. New content should not be able to mint those, so imported slugs are normalised to
// this shape rather than the pattern relaxing to accept them.
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Same shape as a slug, used for the CTA campaign id.
export const CMPID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const SITE_NAME_MAX_LENGTH = 60;
export const SPACE_NAME_MAX_LENGTH = 60;
export const SLUG_MAX_LENGTH = 50;

export const BLOG_TITLE_MAX_LENGTH = 200;
export const BLOG_DESCRIPTION_MAX_LENGTH = 400;
export const BLOG_SUMMARY_MIN_LENGTH = 120;
export const BLOG_SUMMARY_MAX_LENGTH = 600;
export const BLOG_UPDATE_NOTE_MAX_LENGTH = 300;
export const BLOG_MAX_TAGS = 10;
// The FAQ list has no maximum
export const FAQ_QUESTION_MAX_LENGTH = 300;
export const FAQ_ANSWER_MAX_LENGTH = 2000;

export const CATEGORY_TITLE_MAX_LENGTH = 100;
export const CATEGORY_DESCRIPTION_MAX_LENGTH = 350;
export const CATEGORY_SEO_TITLE_MAX_LENGTH = 60;
export const CATEGORY_SEO_DESCRIPTION_MIN_LENGTH = 60;
export const CATEGORY_SEO_DESCRIPTION_MAX_LENGTH = 160;
// Short stable internal identifier — mm2, sab, gag, pvsb
export const GAME_CODE_MAX_LENGTH = 20;
export const GAME_CODE_PATTERN = /^[a-z0-9]+$/;

export const TAG_TITLE_MAX_LENGTH = 50;
export const TAG_DESCRIPTION_MAX_LENGTH = 300;

export const AUTHOR_NAME_MAX_LENGTH = 120;
export const AUTHOR_JOB_TITLE_MAX_LENGTH = 120;
// Long-form, Markdown-style text, which 2000 characters would not hold
export const AUTHOR_BIO_MAX_LENGTH = 10_000;
export const AUTHOR_MAX_SOCIAL_LINKS = 10;

export const CTA_TITLE_MAX_LENGTH = 60;
export const CTA_DESCRIPTION_MAX_LENGTH = 160;
export const CTA_BUTTON_LABEL_MAX_LENGTH = 40;
export const CTA_CMPID_MAX_LENGTH = 60;
// The shape of a CTA url: an https URL with a plain hostname, or a relative /path. Whether that host
// is the CTA's own Site is decided by isCtaUrlOnSite, since the domain belongs to the Site, not here.
// The negative lookahead is load-bearing: `/[^\s]*` alone matches `//evil.com`, which every browser
// treats as an off-site protocol-relative link, and `/\evil.com`, which several normalise to `//`.
// This value is stored and rendered inside published pages, so that is a stored open redirect.
// The host must be followed by `/` or the end, so `https://site.com@evil.com` never parses as
// site.com.
export const CTA_URL_PATTERN =
  /^(https:\/\/([a-z0-9-]+\.)+[a-z0-9-]+(\/.*)?|\/(?![/\\])[^\s]*)$/;

/** The bare host a Site's `domain` field names: no scheme, path, port or leading `www.`. */
export function siteHost(domain: string): string {
  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[/:?#].*$/, "")
    .replace(/^www\./, "");
}

/**
 * Whether a CTA url (already matching CTA_URL_PATTERN) stays on the Site whose domain is given: a
 * relative path, or https on that domain or any subdomain of it. Anything else would send readers
 * off-site from a published page.
 */
export function isCtaUrlOnSite(url: string, siteDomain: string): boolean {
  if (url.startsWith("/")) return !/^\/[/\\]/.test(url);
  const host = siteHost(siteDomain);
  if (!host) return false;
  let urlHost: string;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    urlHost = parsed.hostname.toLowerCase();
  } catch {
    return false;
  }
  return urlHost === host || urlHost.endsWith(`.${host}`);
}

export const FEATURED_ARTICLES_MIN = 1;
export const FEATURED_ARTICLES_MAX = 10;

export const LIST_DEFAULT_PAGE_SIZE = 25;
export const LIST_MAX_PAGE_SIZE = 100;

export const MEDIA_FILENAME_MAX_LENGTH = 255;
export const MEDIA_ALT_TEXT_MAX_LENGTH = 500;
// A presigned PUT cannot cap the body, so the API also checks the stored object's real size
export const MEDIA_MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
// Images only, and not SVG: an SVG can carry script and media is served unprocessed
export const MEDIA_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
] as const;

// ── Users and passwords ───────────────────────────────────────────────
export const EMAIL_MAX_LENGTH = 254;
export const USER_NAME_MAX_LENGTH = 120;
// Length rather than composition rules, as NIST advises: a long passphrase beats "Passw0rd!"
export const PASSWORD_MIN_LENGTH = 12;
// Room for any passphrase or password manager, and a bound on the work one sign-in can cost
export const PASSWORD_MAX_LENGTH = 128;
// A password link's token is 43 characters; anything far longer is not one
export const PASSWORD_LINK_TOKEN_MAX_LENGTH = 100;

export const API_KEY_NAME_MAX_LENGTH = 60;

// MCP tokens: personal, so a person can connect an assistant (Claude, an IDE) to /mcp as themselves
export const MCP_TOKEN_NAME_MAX_LENGTH = 60;
// Days a token works after it is created. A lost one is revoked; a forgotten one runs out.
export const MCP_TOKEN_TTL_DAYS = 90;
// Requests per minute a key may make — the schema default of 600 is the generous default
export const API_KEY_RATE_LIMIT_MAX = 100_000;

// Global search: shorter queries match nearly everything, and trigrams need three characters to rank
export const SEARCH_QUERY_MIN_LENGTH = 2;
export const SEARCH_QUERY_MAX_LENGTH = 100;
export const SEARCH_MAX_RESULTS = 30;

// A bulk action runs item by item in one request; past this, select fewer or filter first
export const BULK_MAX_ITEMS = 100;
