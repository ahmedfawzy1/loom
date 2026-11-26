import {
  AuditAction,
  type Blog,
  type BlogLocale,
  type BlogVersion,
  type CmsContentType,
  Prisma,
  type SiteLanguage,
} from "@loom/database";
import { CONTENT_TYPE_LABELS } from "@loom/dto/constants";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { type ContentDelegate, contentKind } from "./content-kind.registry";
import type { SnapshotProvenance } from "./snapshot.util";
import type { LocaleState } from "./workflow.util";

type Client = Prisma.TransactionClient;

/** The canonical columns every content table shares. */
export type CanonicalRow = Pick<Blog, "id" | "spaceId" | "deletedAt">;

/** The locale columns every content table shares. */
export type LocaleRow = LocaleState &
  Pick<
    BlogLocale,
    | "id"
    | "spaceId"
    | "languageCode"
    | "submittedAt"
    | "reviewNote"
    | "reviewedAt"
    | "sourceRevision"
    | "contentRevision"
    | "publishedAt"
    | "updatedAt"
  >;

export type VersionRow = Pick<
  BlogVersion,
  "revision" | "snapshot" | "note" | "createdById" | "createdAt"
>;

// The registry cannot know a type's row shape; these can, because they only read what every
// type shares — so the narrowing happens once, here
export const canonicalDelegate = (client: Client, type: CmsContentType) =>
  contentKind(type).canonical(client) as ContentDelegate<CanonicalRow>;

export const localeDelegate = (client: Client, type: CmsContentType) =>
  contentKind(type).locale(client) as ContentDelegate<LocaleRow>;

export const versionDelegate = (client: Client, type: CmsContentType) =>
  contentKind(type).version(client) as ContentDelegate<VersionRow>;

export async function requireItem(
  client: Client,
  type: CmsContentType,
  id: CanonicalRow["id"],
): Promise<CanonicalRow> {
  const item = await canonicalDelegate(client, type).findUnique({
    where: { id },
  });
  if (!item)
    throw new NotFoundException(`${CONTENT_TYPE_LABELS[type]} ${id} not found`);
  return item;
}

export async function requireLocale(
  client: Client,
  type: CmsContentType,
  itemId: CanonicalRow["id"],
  languageCode: SiteLanguage["code"],
): Promise<LocaleRow> {
  const locale = await localeDelegate(client, type).findFirst({
    where: { [contentKind(type).localeForeignKey]: itemId, languageCode },
  });
  if (!locale)
    throw new NotFoundException(
      `This ${CONTENT_TYPE_LABELS[type].toLowerCase()} has no ${languageCode} version yet`,
    );
  return locale;
}

/**
 * Trash is where an item waits to be restored or purged, not a state to keep working in: an edit
 * or a publish there would change something nobody can see in any list.
 */
export function assertNotTrashed(
  item: Pick<CanonicalRow, "deletedAt">,
  type: CmsContentType,
) {
  if (item.deletedAt)
    throw new ConflictException(
      `This ${CONTENT_TYPE_LABELS[type].toLowerCase()} is in the Trash — restore it before changing it`,
    );
}

/**
 * What a locale save can carry beyond its own fields. A restore passes the version's canonical
 * block (only ever for the default language), so the whole restore is one save and one
 * version rather than two.
 */
export interface LocaleSaveOptions<TCanonical> {
  canonical?: TCanonical;
  restoredFrom?: BlogVersion["revision"];
  /** A machine translation, made from this contentRevision of the source language. */
  translatedFrom?: BlogLocale["contentRevision"];
  /** Someone confirmed this language matches this contentRevision of the source. */
  confirmedAgainst?: BlogLocale["contentRevision"];
  /** What this language now counts as made from; absent leaves it as it was. */
  provenance?: SnapshotProvenance;
}

/** The locale columns a save writes to record provenance, or nothing when it has none to record. */
export const provenanceData = (provenance: SnapshotProvenance | undefined) =>
  provenance
    ? {
        sourceRevision: provenance.sourceRevision,
        sourceBaseline:
          provenance.sourceBaseline === null
            ? Prisma.DbNull
            : (provenance.sourceBaseline as Prisma.InputJsonValue),
      }
    : {};

/**
 * What a restored translation counts as made from. A version saved before provenance was recorded
 * says nothing, and keeping today's would vouch for old text — so it comes back Untracked.
 */
export const restoredProvenance = (
  provenance: SnapshotProvenance | undefined,
  languageCode: SiteLanguage["code"],
  defaultLanguage: SiteLanguage["code"],
): SnapshotProvenance | undefined =>
  languageCode === defaultLanguage
    ? undefined
    : (provenance ?? { sourceRevision: null, sourceBaseline: null });

/** The note a save's version carries — only restores and translations say where they came from. */
export const saveNote = (
  options: LocaleSaveOptions<unknown>,
  sourceLanguage: SiteLanguage["code"],
): BlogVersion["note"] | undefined =>
  options.restoredFrom
    ? `Restored from version ${options.restoredFrom}`
    : options.translatedFrom !== undefined
      ? `Translated from ${sourceLanguage} version ${options.translatedFrom}`
      : options.confirmedAgainst !== undefined
        ? `Confirmed up to date with ${sourceLanguage} version ${options.confirmedAgainst}`
        : undefined;

/** How a save is logged: an edit, a restore or a translation. */
export const saveAudit = (options: LocaleSaveOptions<unknown>) =>
  options.restoredFrom
    ? {
        action: AuditAction.VERSION_RESTORED,
        metadata: { revision: options.restoredFrom },
      }
    : options.translatedFrom !== undefined
      ? {
          action: AuditAction.CONTENT_TRANSLATED,
          metadata: { sourceRevision: options.translatedFrom },
        }
      : options.confirmedAgainst !== undefined
        ? {
            action: AuditAction.CONTENT_EDITED,
            metadata: { confirmedAgainst: options.confirmedAgainst },
          }
        : { action: AuditAction.CONTENT_EDITED };

/**
 * The sourceRevision a language written by hand starts with: the source as it stood then, so it can
 * go Stale when the source moves on. A translation overrides it through `provenance`. The source
 * language itself has none.
 */
export function initialSourceRevision(
  languageCode: SiteLanguage["code"],
  defaultLanguage: SiteLanguage["code"],
  locales: Pick<BlogLocale, "languageCode" | "contentRevision">[],
): BlogLocale["sourceRevision"] {
  if (languageCode === defaultLanguage) return null;
  return (
    locales.find((locale) => locale.languageCode === defaultLanguage)
      ?.contentRevision ?? null
  );
}

/**
 * A duplicate's translations are measured against the copy's default language, whose content is at
 * revision 1. One that was current stays current; one that was Stale stays Stale (compared, like
 * translationState, against contentRevision), rather than the copy quietly vouching for text
 * nobody updated.
 */
export const copiedSourceRevision = (
  sourceRevision: BlogLocale["sourceRevision"],
  sourceContentRevision: BlogLocale["contentRevision"],
): BlogLocale["sourceRevision"] =>
  sourceRevision === null
    ? null
    : sourceRevision >= sourceContentRevision
      ? 1
      : 0;
