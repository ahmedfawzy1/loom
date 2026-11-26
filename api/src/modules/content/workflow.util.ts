import { type BlogLocale, type CmsUser, LocaleStatus } from "@loom/database";
import { ConflictException } from "@nestjs/common";

/** The publish and review columns every locale table shares. */
export type LocaleState = Pick<
  BlogLocale,
  | "status"
  | "revision"
  | "publishedRevision"
  | "firstPublishedAt"
  | "submittedById"
>;

/** The columns a workflow step writes. */
export type LocaleStateUpdate = Partial<
  Pick<
    BlogLocale,
    | "status"
    | "publishedRevision"
    | "publishedAt"
    | "firstPublishedAt"
    | "submittedById"
    | "submittedAt"
    | "reviewNote"
    | "reviewedById"
    | "reviewedAt"
  >
>;

/**
 * Whether the website serves this locale. Status alone cannot say: CHANGED and IN_REVIEW are both
 * live when they follow a publish and not when they do not.
 */
export const isLive = (locale: Pick<BlogLocale, "publishedRevision">) =>
  locale.publishedRevision !== null;

/**
 * A save. Live content stays live — the version at `publishedRevision` keeps serving and only the
 * working copy moves on. A save during review withdraws the submission:
 * what was submitted is no longer what is there, so approving it would publish something unseen.
 */
export function afterSave(locale: LocaleState): LocaleStateUpdate {
  if (locale.status === LocaleStatus.PUBLISHED)
    return { status: LocaleStatus.CHANGED };
  if (locale.status === LocaleStatus.IN_REVIEW)
    return {
      status: isLive(locale) ? LocaleStatus.CHANGED : LocaleStatus.DRAFT,
      submittedById: null,
      submittedAt: null,
    };
  return {};
}

/** A Writer asks for review. Any earlier reviewer note is answered by this submission. */
export function submit(
  locale: LocaleState,
  actorId: CmsUser["id"],
  now: Date,
): LocaleStateUpdate {
  if (locale.status === LocaleStatus.IN_REVIEW)
    throw new ConflictException("This language is already in review");
  if (locale.status === LocaleStatus.PUBLISHED)
    throw new ConflictException(
      "Nothing to review — the live version is already the latest",
    );
  return {
    status: LocaleStatus.IN_REVIEW,
    submittedById: actorId,
    submittedAt: now,
    reviewNote: null,
    reviewedById: null,
    reviewedAt: null,
  };
}

/**
 * Makes the current revision the live one. From review it is an approval: the submitter is kept so
 * a Writer can still see what happened to their submission. A direct publish clears it, since the
 * submission it would describe is not what went live.
 */
export function publish(
  locale: LocaleState,
  actorId: CmsUser["id"],
  now: Date,
): LocaleStateUpdate {
  if (locale.status === LocaleStatus.PUBLISHED)
    throw new ConflictException("The latest version is already live");

  const fromReview = locale.status === LocaleStatus.IN_REVIEW;
  return {
    status: LocaleStatus.PUBLISHED,
    publishedRevision: locale.revision,
    publishedAt: now,
    firstPublishedAt: locale.firstPublishedAt ?? now,
    reviewNote: null,
    ...(fromReview
      ? { reviewedById: actorId, reviewedAt: now }
      : {
          submittedById: null,
          submittedAt: null,
          reviewedById: null,
          reviewedAt: null,
        }),
  };
}

export function approve(
  locale: LocaleState,
  actorId: CmsUser["id"],
  now: Date,
): LocaleStateUpdate {
  if (locale.status !== LocaleStatus.IN_REVIEW)
    throw new ConflictException("This language is not waiting for review");
  return publish(locale, actorId, now);
}

/**
 * Returns a submission to its Writer, as DRAFT — unless the locale is already live: it keeps
 * serving, and DRAFT would claim it is not, so it goes to CHANGED instead.
 */
export function requestChanges(
  locale: LocaleState,
  actorId: CmsUser["id"],
  note: NonNullable<BlogLocale["reviewNote"]>,
  now: Date,
): LocaleStateUpdate {
  if (locale.status !== LocaleStatus.IN_REVIEW)
    throw new ConflictException("This language is not waiting for review");
  return {
    status: isLive(locale) ? LocaleStatus.CHANGED : LocaleStatus.DRAFT,
    reviewNote: note,
    reviewedById: actorId,
    reviewedAt: now,
  };
}

/**
 * Takes a locale off the website. A pending submission survives — the Writer's edit is still
 * waiting — but it no longer has a live version to replace.
 */
export function unpublish(locale: LocaleState): LocaleStateUpdate {
  if (!isLive(locale)) throw new ConflictException("This language is not live");
  return {
    status:
      locale.status === LocaleStatus.IN_REVIEW
        ? LocaleStatus.IN_REVIEW
        : LocaleStatus.UNPUBLISHED,
    publishedRevision: null,
  };
}
