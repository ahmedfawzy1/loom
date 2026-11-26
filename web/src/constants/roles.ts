import { CmsRole } from "@loom/dto/models";

/** Each role's plain name, where nothing nearby could be mistaken for it. */
export const ROLE_NAMES: Record<CmsRole, string> = {
  [CmsRole.ADMIN]: "Admin",
  [CmsRole.AUTHOR]: "Author",
  [CmsRole.WRITER]: "Writer",
};

/** Each role's name where it is chosen, beside people who might also be blog bylines. */
export const ROLE_LABELS: Record<CmsRole, string> = {
  [CmsRole.ADMIN]: "Admin",
  // Labelled "(role)" wherever the permission level and the blog byline could be confused
  [CmsRole.AUTHOR]: "Author (role)",
  [CmsRole.WRITER]: "Writer",
};

/** What a role lets someone do, in a line, for whoever is choosing it. */
export const ROLE_SUMMARIES: Record<CmsRole, string> = {
  [CmsRole.ADMIN]: "Everything an Author can do, plus Settings and Users.",
  [CmsRole.AUTHOR]: "Writes, reviews and publishes content.",
  [CmsRole.WRITER]:
    "Writes and translates content, and sends it for review. Can't publish.",
};
