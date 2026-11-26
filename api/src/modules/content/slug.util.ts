import { SLUG_MAX_LENGTH } from "@loom/dto/constants";
import { ConflictException } from "@nestjs/common";

// How many numbered copies Duplicate tries before asking for a cleanup instead
const MAX_COPY_ATTEMPTS = 50;

/**
 * Derives a URL-safe slug from a title, to the `^[a-z0-9]+(-[a-z0-9]+)*$` shape Category, Tag and
 * Space slugs must match.
 *
 * A Blog also seeds its slug from this on create, but a Blog slug is not held to that
 * pattern — a translated slug is written in the target language and may be any script. When the
 * title has nothing slug-able in it this returns empty, and the caller asks for an explicit slug
 * rather than inventing one that would collide with the next such title.
 */
export const slugify = (title: string): string =>
  title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    // Again after the slice: cutting to length can land mid-separator and put a trailing dash back,
    // which SLUG_PATTERN rejects
    .replace(/-+$/, "");

/** What a slug conflict looks like once we know which row is holding it. */
export interface SlugHolder {
  id: string;
  title: string;
  deletedAt: Date | null;
}

/**
 * Turns a slug collision into a message that names the blocking item.
 *
 * Soft delete does not free a unique slug and Trash is kept forever, so the row holding it is often
 * in the Trash — where nobody thinks to look, because the list shows nothing. Leaving this to the
 * database's P2002 gives a conflict with no indication of which item to go and deal with.
 */
export function assertSlugFree(
  slug: string,
  holder: SlugHolder | null,
  label: string,
): void {
  if (!holder) return;

  throw new ConflictException(
    holder.deletedAt
      ? `The slug "${slug}" belongs to a trashed ${label} ("${holder.title}"). Restore it and change its slug, or delete it permanently.`
      : `The slug "${slug}" is already used by ${label} "${holder.title}".`,
  );
}

const COPY_TITLE_SUFFIX = " (copy)";

/** The title a duplicate gets, so the copy is distinguishable from its original in every list. */
export const copyTitle = (title: string, maxLength: number): string =>
  `${title.slice(0, maxLength - COPY_TITLE_SUFFIX.length).trimEnd()}${COPY_TITLE_SUFFIX}`;

/**
 * A free slug for a duplicate: `-copy`, then `-copy-2` and so on, shortened to fit the length cap.
 * A copy cannot share its original's slug, and asking the user for one first would make Duplicate
 * a form rather than a button.
 */
export async function copySlug(
  slug: string,
  isTaken: (candidate: string) => Promise<boolean>,
): Promise<string> {
  for (let attempt = 1; attempt <= MAX_COPY_ATTEMPTS; attempt++) {
    const suffix = attempt === 1 ? "-copy" : `-copy-${attempt}`;
    const candidate = `${slug.slice(0, SLUG_MAX_LENGTH - suffix.length).replace(/-+$/, "")}${suffix}`;
    if (!(await isTaken(candidate))) return candidate;
  }
  throw new ConflictException(
    `Every copy slug up to "${slug}-copy-${MAX_COPY_ATTEMPTS}" is taken — rename or delete some copies first`,
  );
}
