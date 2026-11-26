import {
  type Author,
  type Blog,
  type BlogLocale,
  type BlogTag,
  type Category,
  type Cta,
  Prisma,
  type Space,
  type Tag,
} from "@loom/database";
import { Injectable } from "@nestjs/common";
import {
  type ReferenceMaps,
  type RichTextNode,
  remapReferences,
} from "../content/rich-text.util";
import {
  authorSnapshot,
  type BlogCanonical,
  blogSnapshot,
  categorySnapshot,
  ctaSnapshot,
  featuredArticlesSnapshot,
  type SnapshotProvenance,
  tagSnapshot,
} from "../content/snapshot.util";
import { retargetBody } from "../content/translation-baseline.util";
import { CLONE_VERSION_NOTE } from "./space.constants";

type Tx = Prisma.TransactionClient;

const jsonOrDbNull = (value: unknown) =>
  value === null || value === undefined
    ? Prisma.DbNull
    : (value as Prisma.InputJsonValue);

/** Maps a source row id to the id of its copy in the new Space. */
type IdMap<T extends { id: unknown }> = Map<T["id"], T["id"]>;

/** The publish and review state a cloned locale carries over verbatim — the same columns on every locale table. */
type CloneableLocale = Pick<
  BlogLocale,
  | "id"
  | "status"
  | "revision"
  | "contentRevision"
  | "sourceRevision"
  | "sourceBaseline"
  | "firstPublishedAt"
  | "publishedAt"
  | "publishedRevision"
  | "submittedById"
  | "submittedAt"
  | "reviewNote"
  | "reviewedById"
  | "reviewedAt"
>;

/** The parts of a blog version snapshot that hold ids from the Space it was taken in. */
interface StoredBlogSnapshot {
  body?: RichTextNode;
  provenance?: SnapshotProvenance;
  canonical?: {
    authorId?: Blog["authorId"];
    reviewerId?: Blog["reviewerId"];
    categoryId?: Blog["categoryId"];
    tagIds?: BlogTag["tagId"][];
  };
}

// An id with no entry is left alone: it is already the clone's own, or it was never in the Space
const remapId = <T extends string | null | undefined>(
  map: Map<string, string>,
  id: T,
): T => (id ? ((map.get(id) as T | undefined) ?? id) : id);

/**
 * A published version is copied from the source, so its canonical block still names the source's
 * author, category and tags. Restoring that version in the clone would otherwise re-point the post
 * back into the Space it was cloned from.
 */
const remapCanonical = (
  canonical: NonNullable<StoredBlogSnapshot["canonical"]>,
  maps: ReferenceMaps,
): NonNullable<StoredBlogSnapshot["canonical"]> => ({
  ...canonical,
  authorId: remapId(maps.entries.author, canonical.authorId),
  reviewerId: remapId(maps.entries.author, canonical.reviewerId),
  categoryId: remapId(maps.entries.category, canonical.categoryId),
  tagIds: canonical.tagIds?.map((id) => remapId(maps.entries.tag, id)),
});

/** One version row to seed a cloned locale with. */
interface SeedVersion {
  revision: number;
  snapshot: Prisma.InputJsonValue;
}

/**
 * Copies one Space's content into another. Media is referenced rather than re-uploaded, and each
 * cloned locale starts with seed versions instead of the source's history.
 *
 * Soft-deleted rows are copied too, with `deletedAt` preserved. The clone's *visible* content is
 * therefore exactly the source's current content — trashed rows appear only in the clone's Trash —
 * while every reference stays resolvable. Skipping them instead would strand a live Blog whose
 * Author is trashed, which is reachable because Trash is a soft delete on the canonical row and
 * is kept forever.
 *
 * Per-locale status carries over, so a cloned Space is immediately viewable.
 */
@Injectable()
export class SpaceCloneService {
  async cloneInto(tx: Tx, source: Space, target: Space): Promise<void> {
    const authors = await this.cloneAuthors(tx, source, target);
    const categories = await this.cloneCategories(tx, source, target);
    const tags = await this.cloneTags(tx, source, target);
    const ctas = await this.cloneCtas(tx, source, target);

    const blogs = await this.cloneBlogs(
      tx,
      source,
      target,
      authors,
      categories,
      tags,
    );
    await this.cloneFeaturedArticles(tx, source, target, blogs);

    // A second pass, because a body can link to another post and the blog map is only complete
    // once every post has been copied
    await this.remapBodies(tx, target, {
      cta: ctas,
      entries: {
        blog: blogs,
        category: categories,
        tag: tags,
        author: authors,
      },
    });
  }

  /**
   * Points every copied body — and the body inside every seed version — at the copies instead of
   * the source Space's records. Without this a cloned post embeds Production's CTAs, so editing or
   * deleting one in Production silently changes pages in the clone.
   */
  private async remapBodies(tx: Tx, target: Space, maps: ReferenceMaps) {
    const locales = await tx.blogLocale.findMany({
      where: { spaceId: target.id },
      select: { id: true, body: true, sourceBaseline: true },
    });

    for (const locale of locales) {
      const body = locale.body as unknown as RichTextNode;
      const remapped = remapReferences(body, maps);
      if (JSON.stringify(remapped) !== JSON.stringify(body))
        await tx.blogLocale.update({
          where: { id: locale.id },
          data: {
            body: remapped as unknown as Prisma.InputJsonValue,
            sourceBaseline: jsonOrDbNull(
              retargetBody(locale.sourceBaseline, body, remapped),
            ),
          },
        });
    }

    const versions = await tx.blogVersion.findMany({
      where: { locale: { spaceId: target.id } },
      select: { id: true, snapshot: true },
    });

    for (const version of versions) {
      const snapshot = version.snapshot as StoredBlogSnapshot | null;
      if (!snapshot) continue;

      const remapped: StoredBlogSnapshot = {
        ...snapshot,
        ...(snapshot.body
          ? { body: remapReferences(snapshot.body, maps) }
          : {}),
        ...(snapshot.canonical
          ? { canonical: remapCanonical(snapshot.canonical, maps) }
          : {}),
      };
      if (snapshot.body && snapshot.provenance)
        remapped.provenance = {
          ...snapshot.provenance,
          sourceBaseline: retargetBody(
            snapshot.provenance.sourceBaseline,
            snapshot.body,
            remapped.body,
          ) as Prisma.JsonValue,
        };
      if (JSON.stringify(remapped) !== JSON.stringify(snapshot))
        await tx.blogVersion.update({
          where: { id: version.id },
          data: { snapshot: remapped as unknown as Prisma.InputJsonValue },
        });
    }
  }

  private note(source: Space) {
    return `${CLONE_VERSION_NOTE} ${source.name}`;
  }

  /** Publish and review state, carried whole so an IN_REVIEW clone keeps who submitted it. */
  private localeState(locale: CloneableLocale) {
    return {
      status: locale.status,
      revision: locale.revision,
      contentRevision: locale.contentRevision,
      sourceRevision: locale.sourceRevision,
      sourceBaseline: jsonOrDbNull(locale.sourceBaseline),
      firstPublishedAt: locale.firstPublishedAt,
      publishedAt: locale.publishedAt,
      publishedRevision: locale.publishedRevision,
      submittedById: locale.submittedById,
      submittedAt: locale.submittedAt,
      reviewNote: locale.reviewNote,
      reviewedById: locale.reviewedById,
      reviewedAt: locale.reviewedAt,
    };
  }

  /**
   * Which source revisions still need a version row in the clone: the locale's own always, plus the
   * published one whenever an edit is pending. A CHANGED locale holds the draft in its columns and
   * the live text only in the version at `publishedRevision` — copying just the current revision
   * would leave that pointer dangling and lose what is actually serving.
   */
  private publishedRevisionsOf(locales: CloneableLocale[]) {
    return locales.flatMap((locale) =>
      locale.publishedRevision !== null &&
      locale.publishedRevision !== locale.revision
        ? [{ localeId: locale.id, revision: locale.publishedRevision }]
        : [],
    );
  }

  private seedVersions(
    locale: CloneableLocale,
    currentSnapshot: object,
    publishedSnapshot: Prisma.InputJsonValue | undefined,
  ): SeedVersion[] {
    const versions: SeedVersion[] = [
      {
        revision: locale.revision,
        snapshot: currentSnapshot as Prisma.InputJsonObject,
      },
    ];
    if (
      locale.publishedRevision !== null &&
      locale.publishedRevision !== locale.revision &&
      publishedSnapshot !== undefined
    )
      versions.push({
        revision: locale.publishedRevision,
        snapshot: publishedSnapshot,
      });
    return versions;
  }

  private async cloneAuthors(tx: Tx, source: Space, target: Space) {
    const rows = await tx.author.findMany({
      where: { spaceId: source.id },
      include: { locales: true },
    });

    const pending = this.publishedRevisionsOf(
      rows.flatMap((row) => row.locales),
    );
    const publishedVersions = pending.length
      ? await tx.authorVersion.findMany({
          where: {
            OR: pending.map((entry) => ({
              authorLocaleId: entry.localeId,
              revision: entry.revision,
            })),
          },
        })
      : [];
    const publishedBy = new Map(
      publishedVersions.map((version) => [version.authorLocaleId, version]),
    );

    const map: IdMap<Author> = new Map();
    for (const row of rows) {
      const canonical = {
        name: row.name,
        profileImageId: row.profileImageId,
        socialLinks: row.socialLinks,
      };

      const created = await tx.author.create({
        data: {
          spaceId: target.id,
          ...canonical,
          createdById: row.createdById,
          deletedAt: row.deletedAt,
          locales: {
            create: row.locales.map((locale) => ({
              spaceId: target.id,
              languageCode: locale.languageCode,
              jobTitle: locale.jobTitle,
              bio: locale.bio,
              ...this.localeState(locale),
            })),
          },
        },
        include: { locales: true },
      });

      const createdBy = new Map(
        created.locales.map((locale) => [locale.languageCode, locale]),
      );

      await tx.authorVersion.createMany({
        data: row.locales.flatMap((locale) => {
          const clone = createdBy.get(locale.languageCode);
          if (!clone) return [];
          return this.seedVersions(
            locale,
            authorSnapshot(locale, canonical),
            publishedBy.get(locale.id)?.snapshot as
              | Prisma.InputJsonValue
              | undefined,
          ).map((version) => ({
            authorLocaleId: clone.id,
            revision: version.revision,
            snapshot: version.snapshot,
            note: this.note(source),
          }));
        }),
      });

      map.set(row.id, created.id);
    }
    return map;
  }

  private async cloneCategories(tx: Tx, source: Space, target: Space) {
    const rows = await tx.category.findMany({
      where: { spaceId: source.id },
      include: { locales: true },
    });

    const pending = this.publishedRevisionsOf(
      rows.flatMap((row) => row.locales),
    );
    const publishedVersions = pending.length
      ? await tx.categoryVersion.findMany({
          where: {
            OR: pending.map((entry) => ({
              categoryLocaleId: entry.localeId,
              revision: entry.revision,
            })),
          },
        })
      : [];
    const publishedBy = new Map(
      publishedVersions.map((version) => [version.categoryLocaleId, version]),
    );

    const map: IdMap<Category> = new Map();
    for (const row of rows) {
      const canonical = {
        slug: row.slug,
        gameCode: row.gameCode,
        featuredImageId: row.featuredImageId,
        featureIconId: row.featureIconId,
        gameCoverId: row.gameCoverId,
      };

      const created = await tx.category.create({
        data: {
          spaceId: target.id,
          ...canonical,
          createdById: row.createdById,
          deletedAt: row.deletedAt,
          locales: {
            create: row.locales.map((locale) => ({
              spaceId: target.id,
              languageCode: locale.languageCode,
              title: locale.title,
              description: locale.description,
              seoMetaTitle: locale.seoMetaTitle,
              seoMetaDescription: locale.seoMetaDescription,
              ...this.localeState(locale),
            })),
          },
        },
        include: { locales: true },
      });

      const createdBy = new Map(
        created.locales.map((locale) => [locale.languageCode, locale]),
      );

      await tx.categoryVersion.createMany({
        data: row.locales.flatMap((locale) => {
          const clone = createdBy.get(locale.languageCode);
          if (!clone) return [];
          return this.seedVersions(
            locale,
            categorySnapshot(locale, canonical),
            publishedBy.get(locale.id)?.snapshot as
              | Prisma.InputJsonValue
              | undefined,
          ).map((version) => ({
            categoryLocaleId: clone.id,
            revision: version.revision,
            snapshot: version.snapshot,
            note: this.note(source),
          }));
        }),
      });

      map.set(row.id, created.id);
    }
    return map;
  }

  private async cloneTags(tx: Tx, source: Space, target: Space) {
    const rows = await tx.tag.findMany({
      where: { spaceId: source.id },
      include: { locales: true },
    });

    const pending = this.publishedRevisionsOf(
      rows.flatMap((row) => row.locales),
    );
    const publishedVersions = pending.length
      ? await tx.tagVersion.findMany({
          where: {
            OR: pending.map((entry) => ({
              tagLocaleId: entry.localeId,
              revision: entry.revision,
            })),
          },
        })
      : [];
    const publishedBy = new Map(
      publishedVersions.map((version) => [version.tagLocaleId, version]),
    );

    const map: IdMap<Tag> = new Map();
    for (const row of rows) {
      const canonical = {
        slug: row.slug,
        featuredImageId: row.featuredImageId,
      };

      const created = await tx.tag.create({
        data: {
          spaceId: target.id,
          ...canonical,
          createdById: row.createdById,
          deletedAt: row.deletedAt,
          locales: {
            create: row.locales.map((locale) => ({
              spaceId: target.id,
              languageCode: locale.languageCode,
              title: locale.title,
              description: locale.description,
              ...this.localeState(locale),
            })),
          },
        },
        include: { locales: true },
      });

      const createdBy = new Map(
        created.locales.map((locale) => [locale.languageCode, locale]),
      );

      await tx.tagVersion.createMany({
        data: row.locales.flatMap((locale) => {
          const clone = createdBy.get(locale.languageCode);
          if (!clone) return [];
          return this.seedVersions(
            locale,
            tagSnapshot(locale, canonical),
            publishedBy.get(locale.id)?.snapshot as
              | Prisma.InputJsonValue
              | undefined,
          ).map((version) => ({
            tagLocaleId: clone.id,
            revision: version.revision,
            snapshot: version.snapshot,
            note: this.note(source),
          }));
        }),
      });

      map.set(row.id, created.id);
    }
    return map;
  }

  private async cloneCtas(tx: Tx, source: Space, target: Space) {
    const rows = await tx.cta.findMany({
      where: { spaceId: source.id },
      include: { locales: true },
    });

    const pending = this.publishedRevisionsOf(
      rows.flatMap((row) => row.locales),
    );
    const publishedVersions = pending.length
      ? await tx.ctaVersion.findMany({
          where: {
            OR: pending.map((entry) => ({
              ctaLocaleId: entry.localeId,
              revision: entry.revision,
            })),
          },
        })
      : [];
    const publishedBy = new Map(
      publishedVersions.map((version) => [version.ctaLocaleId, version]),
    );

    const map: IdMap<Cta> = new Map();
    for (const row of rows) {
      const canonical = {
        url: row.url,
        cmpid: row.cmpid,
        imageId: row.imageId,
      };

      const created = await tx.cta.create({
        data: {
          spaceId: target.id,
          ...canonical,
          createdById: row.createdById,
          deletedAt: row.deletedAt,
          locales: {
            create: row.locales.map((locale) => ({
              spaceId: target.id,
              languageCode: locale.languageCode,
              title: locale.title,
              description: locale.description,
              buttonLabel: locale.buttonLabel,
              ...this.localeState(locale),
            })),
          },
        },
        include: { locales: true },
      });

      const createdBy = new Map(
        created.locales.map((locale) => [locale.languageCode, locale]),
      );

      await tx.ctaVersion.createMany({
        data: row.locales.flatMap((locale) => {
          const clone = createdBy.get(locale.languageCode);
          if (!clone) return [];
          return this.seedVersions(
            locale,
            ctaSnapshot(locale, canonical),
            publishedBy.get(locale.id)?.snapshot as
              | Prisma.InputJsonValue
              | undefined,
          ).map((version) => ({
            ctaLocaleId: clone.id,
            revision: version.revision,
            snapshot: version.snapshot,
            note: this.note(source),
          }));
        }),
      });

      map.set(row.id, created.id);
    }
    return map;
  }

  private async cloneBlogs(
    tx: Tx,
    source: Space,
    target: Space,
    authors: IdMap<Author>,
    categories: IdMap<Category>,
    tags: IdMap<Tag>,
  ) {
    const rows = await tx.blog.findMany({
      where: { spaceId: source.id },
      include: { locales: true, tags: true },
    });

    const pending = this.publishedRevisionsOf(
      rows.flatMap((row) => row.locales),
    );
    const publishedVersions = pending.length
      ? await tx.blogVersion.findMany({
          where: {
            OR: pending.map((entry) => ({
              blogLocaleId: entry.localeId,
              revision: entry.revision,
            })),
          },
        })
      : [];
    const publishedBy = new Map(
      publishedVersions.map((version) => [version.blogLocaleId, version]),
    );

    const map: IdMap<Blog> = new Map();
    for (const row of rows) {
      const authorId = authors.get(row.authorId);
      // Every Author in the Space is cloned, trashed or not, so this cannot miss
      if (!authorId)
        throw new Error(
          `Blog ${row.id} references author ${row.authorId}, which was not cloned`,
        );

      const canonical: BlogCanonical = {
        authorId,
        reviewerId: row.reviewerId
          ? (authors.get(row.reviewerId) ?? null)
          : null,
        categoryId: row.categoryId
          ? (categories.get(row.categoryId) ?? null)
          : null,
        imageId: row.imageId,
        tagIds: row.tags.flatMap((tag) => {
          const tagId = tags.get(tag.tagId);
          return tagId ? [tagId] : [];
        }),
      };

      const created = await tx.blog.create({
        data: {
          spaceId: target.id,
          authorId,
          reviewerId: canonical.reviewerId,
          categoryId: canonical.categoryId,
          imageId: row.imageId,
          createdById: row.createdById,
          deletedAt: row.deletedAt,
          tags: {
            create: row.tags.flatMap((tag) => {
              const tagId = tags.get(tag.tagId);
              return tagId ? [{ tagId, position: tag.position }] : [];
            }),
          },
          locales: {
            create: row.locales.map((locale) => ({
              spaceId: target.id,
              languageCode: locale.languageCode,
              title: locale.title,
              description: locale.description,
              slug: locale.slug,
              summary: locale.summary,
              updateNote: locale.updateNote,
              body: locale.body as Prisma.InputJsonValue,
              faq: locale.faq as Prisma.InputJsonValue,
              ...this.localeState(locale),
            })),
          },
        },
        include: { locales: true },
      });

      const createdBy = new Map(
        created.locales.map((locale) => [locale.languageCode, locale]),
      );

      await tx.blogVersion.createMany({
        data: row.locales.flatMap((locale) => {
          const clone = createdBy.get(locale.languageCode);
          if (!clone) return [];
          return this.seedVersions(
            locale,
            blogSnapshot(locale, canonical),
            publishedBy.get(locale.id)?.snapshot as
              | Prisma.InputJsonValue
              | undefined,
          ).map((version) => ({
            blogLocaleId: clone.id,
            revision: version.revision,
            snapshot: version.snapshot,
            note: this.note(source),
          }));
        }),
      });

      map.set(row.id, created.id);
    }
    return map;
  }

  private async cloneFeaturedArticles(
    tx: Tx,
    source: Space,
    target: Space,
    blogs: IdMap<Blog>,
  ): Promise<void> {
    const featured = await tx.featuredArticles.findUnique({
      where: { spaceId: source.id },
      include: { locales: { include: { items: true } } },
    });

    const created = await tx.featuredArticles.create({
      data: {
        spaceId: target.id,
        createdById: featured?.createdById,
        deletedAt: featured?.deletedAt,
        locales: {
          create: (featured?.locales ?? []).map((locale) => ({
            spaceId: target.id,
            languageCode: locale.languageCode,
            ...this.localeState(locale),
            items: {
              create: locale.items.flatMap((item) => {
                const blogId = blogs.get(item.blogId);
                return blogId ? [{ blogId, position: item.position }] : [];
              }),
            },
          })),
        },
      },
      include: { locales: { include: { items: true } } },
    });

    await tx.featuredArticlesVersion.createMany({
      data: created.locales.map((locale) => ({
        featuredArticlesLocaleId: locale.id,
        revision: locale.revision,
        snapshot: featuredArticlesSnapshot(
          locale.items
            .sort((a, b) => a.position - b.position)
            .map((item) => item.blogId),
        ),
        note: this.note(source),
      })),
    });
  }
}
