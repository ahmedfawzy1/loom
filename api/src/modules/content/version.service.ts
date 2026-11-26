import {
  type BlogVersion,
  CmsContentType,
  type CmsUser,
  Prisma,
  type SiteLanguage,
} from "@loom/database";
import type {
  ContentVersionDetailResponseDto,
  ContentVersionResponseDto,
} from "@loom/dto";
import { Injectable, NotFoundException } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import {
  type CanonicalRow,
  localeDelegate,
  requireLocale,
  versionDelegate,
} from "./content-item.util";
import { contentKind } from "./content-kind.registry";
import {
  authorSnapshot,
  blogSnapshot,
  categorySnapshot,
  ctaSnapshot,
  featuredArticlesSnapshot,
  tagSnapshot,
} from "./snapshot.util";
import { stableStringify } from "./stable-json.util";
import { afterSave } from "./workflow.util";

type Tx = Prisma.TransactionClient;

/** Reads a locale and its canonical row back as the snapshot a version records. */
const SNAPSHOT_OF: Record<
  CmsContentType,
  (tx: Tx, localeId: string) => Promise<object>
> = {
  [CmsContentType.BLOG]: async (tx, id) => {
    const { blog, ...locale } = await tx.blogLocale.findUniqueOrThrow({
      where: { id },
      include: {
        blog: { include: { tags: { orderBy: { position: "asc" } } } },
      },
    });
    return blogSnapshot(locale, {
      ...blog,
      tagIds: blog.tags.map((tag) => tag.tagId),
    });
  },
  [CmsContentType.CATEGORY]: async (tx, id) => {
    const { category, ...locale } = await tx.categoryLocale.findUniqueOrThrow({
      where: { id },
      include: { category: true },
    });
    return categorySnapshot(locale, category);
  },
  [CmsContentType.TAG]: async (tx, id) => {
    const { tag, ...locale } = await tx.tagLocale.findUniqueOrThrow({
      where: { id },
      include: { tag: true },
    });
    return tagSnapshot(locale, tag);
  },
  [CmsContentType.AUTHOR]: async (tx, id) => {
    const { author, ...locale } = await tx.authorLocale.findUniqueOrThrow({
      where: { id },
      include: { author: true },
    });
    return authorSnapshot(locale, author);
  },
  [CmsContentType.CTA]: async (tx, id) => {
    const { cta, ...locale } = await tx.ctaLocale.findUniqueOrThrow({
      where: { id },
      include: { cta: true },
    });
    return ctaSnapshot(locale, cta);
  },
  [CmsContentType.FEATURED_ARTICLES]: async (tx, id) => {
    const items = await tx.featuredArticlesItem.findMany({
      where: { localeId: id },
      orderBy: { position: "asc" },
    });
    return featuredArticlesSnapshot(items.map((item) => item.blogId));
  },
};

/**
 * The part of a snapshot a translation follows: the translated and copied fields. Not the shared
 * ones — a translation is served the default language's shared fields, so a new image or tag
 * leaves nothing in it to update. A type with nothing to translate is compared whole.
 */
function translatableContent(type: CmsContentType, snapshot: unknown) {
  const spec = contentKind(type).translation;
  if (!spec || !snapshot || typeof snapshot !== "object")
    return stableStringify(snapshot);
  const fields = [
    ...spec.translated.map((field) => field.name),
    ...spec.copied,
  ];
  return stableStringify(
    Object.fromEntries(
      fields.map((field) => [
        field,
        (snapshot as Record<string, unknown>)[field],
      ]),
    ),
  );
}

/** A snapshot as the website would serve it: provenance is bookkeeping, never served. */
function servedContent(snapshot: unknown) {
  if (!snapshot || typeof snapshot !== "object")
    return stableStringify(snapshot);
  const { provenance: _, ...served } = snapshot as Record<string, unknown>;
  return stableStringify(served);
}

/**
 * Every save is a version, kept forever. Content services call `commit` inside the
 * transaction that wrote the locale, so a save and its version land together or not at all.
 */
@Injectable()
export class VersionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records a save: the next revision, its snapshot, and the status a save moves the locale to. A
   * locale this transaction just created has no version yet, so it is recorded at its first
   * revision rather than bumped past it.
   */
  async commit(
    tx: Tx,
    type: CmsContentType,
    localeId: string,
    actor: AuthenticatedUser,
    note?: BlogVersion["note"],
  ): Promise<void> {
    // Taken before reading, so a publish cannot land between this read and the write below — it
    // would otherwise be overwritten by a revision bump that leaves it marked Published but not live.
    // A locale save already holds this lock from its upsert; a shared-field save does not.
    await tx.$queryRaw`SELECT 1 FROM ${Prisma.raw(`"${contentKind(type).localeTable}"`)} WHERE "id" = ${localeId} FOR UPDATE`;

    const locales = localeDelegate(tx, type);
    const locale = await locales.findUnique({ where: { id: localeId } });
    if (!locale) throw new NotFoundException(`Locale ${localeId} not found`);

    const previous = await versionDelegate(tx, type).findFirst({
      where: {
        [contentKind(type).versionForeignKey]: localeId,
        revision: locale.revision,
      },
    });
    const revision = previous ? locale.revision + 1 : locale.revision;
    const snapshot = await SNAPSHOT_OF[type](tx, localeId);

    // Only a change translations would have to follow moves contentRevision (see translationState)
    const contentChanged =
      !previous ||
      translatableContent(type, previous.snapshot) !==
        translatableContent(type, snapshot);
    // A save that leaves what is served as it was — "Mark up to date" — neither makes a live
    // language Changed nor withdraws a submission
    const servedChanged =
      !previous || servedContent(previous.snapshot) !== servedContent(snapshot);

    await locales.update({
      where: { id: localeId },
      data: {
        revision,
        ...(contentChanged ? { contentRevision: revision } : {}),
        ...(servedChanged ? afterSave(locale) : {}),
      },
    });

    // A save in any language is an edit to the item, which is what the lists sort and filter by. A
    // shared-field save holding the row stamps it itself; waiting for it here could deadlock, since
    // that save locks the item before the locale and this one the other way round
    const kind = contentKind(type);
    const itemId = (locale as unknown as Record<string, unknown>)[
      kind.localeForeignKey
    ] as string;
    const [free] = await tx.$queryRaw<unknown[]>`
      SELECT 1 FROM ${Prisma.raw(`"${kind.canonicalTable}"`)} WHERE "id" = ${itemId} FOR UPDATE SKIP LOCKED
    `;
    if (free)
      await tx.$executeRaw`
        UPDATE ${Prisma.raw(`"${kind.canonicalTable}"`)} SET "updatedAt" = now() WHERE "id" = ${itemId}
      `;
    await this.write(
      tx,
      type,
      localeId,
      revision,
      actor.id,
      note ?? null,
      snapshot,
    );
  }

  /**
   * Makes sure the current revision has a version before it is published — rows saved before
   * versioning existed have none, and `publishedRevision` must always point at one.
   */
  async ensureRecorded(
    tx: Tx,
    type: CmsContentType,
    localeId: string,
    revision: number,
    actorId: CmsUser["id"],
  ): Promise<void> {
    if (!(await this.isRecorded(tx, type, localeId, revision)))
      await this.write(
        tx,
        type,
        localeId,
        revision,
        actorId,
        null,
        await SNAPSHOT_OF[type](tx, localeId),
      );
  }

  async list(
    type: CmsContentType,
    itemId: CanonicalRow["id"],
    languageCode: SiteLanguage["code"],
  ): Promise<ContentVersionResponseDto[]> {
    const locale = await requireLocale(this.prisma, type, itemId, languageCode);
    const versions = await versionDelegate(this.prisma, type).findMany({
      where: { [contentKind(type).versionForeignKey]: locale.id },
      orderBy: { revision: "desc" },
      select: {
        revision: true,
        note: true,
        createdById: true,
        createdAt: true,
      },
    });
    const users = await this.usersById(versions.map((v) => v.createdById));

    return versions.map((version) => ({
      revision: version.revision,
      note: version.note,
      createdAt: version.createdAt,
      createdBy: version.createdById
        ? (users.get(version.createdById) ?? null)
        : null,
      isPublished: version.revision === locale.publishedRevision,
      isCurrent: version.revision === locale.revision,
    }));
  }

  async get(
    type: CmsContentType,
    itemId: CanonicalRow["id"],
    languageCode: SiteLanguage["code"],
    revision: BlogVersion["revision"],
  ): Promise<ContentVersionDetailResponseDto> {
    const locale = await requireLocale(this.prisma, type, itemId, languageCode);
    const version = await versionDelegate(this.prisma, type).findFirst({
      where: { [contentKind(type).versionForeignKey]: locale.id, revision },
    });
    if (!version)
      throw new NotFoundException(
        `There is no version ${revision} of this ${languageCode} content`,
      );
    const users = await this.usersById([version.createdById]);

    return {
      revision: version.revision,
      note: version.note,
      createdAt: version.createdAt,
      createdBy: version.createdById
        ? (users.get(version.createdById) ?? null)
        : null,
      isPublished: version.revision === locale.publishedRevision,
      isCurrent: version.revision === locale.revision,
      snapshot: version.snapshot,
    };
  }

  private async isRecorded(
    tx: Tx,
    type: CmsContentType,
    localeId: string,
    revision: number,
  ) {
    const count = await versionDelegate(tx, type).count({
      where: { [contentKind(type).versionForeignKey]: localeId, revision },
    });
    return count > 0;
  }

  private async write(
    tx: Tx,
    type: CmsContentType,
    localeId: string,
    revision: number,
    createdById: CmsUser["id"],
    note: BlogVersion["note"],
    snapshot: object,
  ) {
    await versionDelegate(tx, type).create({
      data: {
        [contentKind(type).versionForeignKey]: localeId,
        revision,
        // A snapshot is plain JSON built from the row; as an object type it has no index signature
        snapshot: snapshot as Prisma.InputJsonObject,
        note,
        createdById,
      },
    });
  }

  private async usersById(ids: (CmsUser["id"] | null)[]) {
    const wanted = [...new Set(ids.filter((id): id is string => Boolean(id)))];
    const users = wanted.length
      ? await this.prisma.cmsUser.findMany({
          where: { id: { in: wanted } },
          select: { id: true, email: true, name: true },
        })
      : [];
    return new Map(users.map((user) => [user.id, user]));
  }
}
