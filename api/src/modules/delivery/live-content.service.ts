import {
  type Blog,
  type BlogLocale,
  CmsContentType,
  Prisma,
  type SiteLanguage,
  type Space,
} from "@loom/database";
import { Injectable, NotFoundException } from "@nestjs/common";
import {
  type CanonicalRow,
  type LocaleRow,
  localeDelegate,
  type VersionRow,
  versionDelegate,
} from "../content/content-item.util";
import { contentKind } from "../content/content-kind.registry";
import { servedCanonical } from "../content/live-canonical.util";
import type {
  AuthorSnapshot,
  BlogSnapshot,
  CategorySnapshot,
  CtaSnapshot,
  FeaturedArticlesSnapshot,
  TagSnapshot,
} from "../content/snapshot.util";
import { PrismaService } from "../prisma/prisma.service";

/** One item as the website is served it in one language: its live snapshot and the shared fields served with it. */
export interface LiveItem<TSnapshot> {
  id: CanonicalRow["id"];
  languageCode: BlogLocale["languageCode"];
  firstPublishedAt: NonNullable<BlogLocale["firstPublishedAt"]>;
  publishedAt: NonNullable<BlogLocale["publishedAt"]>;
  snapshot: TSnapshot;
}

interface SnapshotOf {
  [CmsContentType.BLOG]: BlogSnapshot;
  [CmsContentType.CATEGORY]: CategorySnapshot;
  [CmsContentType.TAG]: TagSnapshot;
  [CmsContentType.AUTHOR]: AuthorSnapshot;
  [CmsContentType.CTA]: CtaSnapshot;
  [CmsContentType.FEATURED_ARTICLES]: FeaturedArticlesSnapshot;
}

/** Where to look: the Space, the language asked for, and whether to fall back to the default. */
export interface LiveScope {
  spaceId: Space["id"];
  languageCode: SiteLanguage["code"];
  defaultLanguage: SiteLanguage["code"];
  /** References fall back so a byline or an embed is never lost; what was asked for does not. */
  fallback: boolean;
  /**
   * Draft preview: read every locale's latest saved version (`revision`) instead of its published
   * one, drafts included. Everything else holds — shared fields from the default language, nothing
   * from the Trash — so a preview shows what publishing everything now would put on the site.
   */
  preview?: boolean;
}

/** Which version of a locale is served: the published one, or in preview the latest saved. */
const servedRevision = (
  locale: Pick<LocaleRow, "revision" | "publishedRevision">,
  preview: boolean | undefined,
) => (preview ? locale.revision : locale.publishedRevision);

/**
 * A draft has never been published, so in preview its dates are stand-ins: first published when it
 * was, else when it was last saved; published as of its last save, which is what publishing now
 * would make it.
 */
const servedDates = (
  locale: Pick<LocaleRow, "firstPublishedAt" | "publishedAt" | "updatedAt">,
  preview: boolean | undefined,
) =>
  preview
    ? {
        firstPublishedAt: locale.firstPublishedAt ?? locale.updatedAt,
        publishedAt: locale.updatedAt,
      }
    : {
        firstPublishedAt: locale.firstPublishedAt,
        publishedAt: locale.publishedAt,
      };

/** What the post queries need of a scope: they never fall back on their own. */
type BlogScope = Pick<
  LiveScope,
  "spaceId" | "languageCode" | "defaultLanguage" | "preview"
>;

/** A post without its body and FAQ — what lists and links need. */
export type BlogSummarySnapshot = Omit<
  BlogSnapshot,
  "body" | "faq" | "provenance"
>;

interface BlogRow<TSnapshot> {
  id: Blog["id"];
  languageCode: BlogLocale["languageCode"];
  firstPublishedAt: Date;
  publishedAt: Date;
  snapshot: TSnapshot;
  canonical: BlogSnapshot["canonical"];
}

export interface BlogFilter {
  ids?: Blog["id"][];
  categoryId?: string;
  tagId?: string;
  authorId?: string;
  slug?: BlogLocale["slug"];
}

/**
 * What is live, read the way the website is served it: the snapshot at
 * `publishedRevision`, never the working row; shared fields from the default language's live
 * snapshot; nothing from the Trash.
 */
@Injectable()
export class LiveContentService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Live items of one type in a language, keyed by id — every one in the Space, or just `ids`. Two
   * queries whatever the count: the locales in the language and the default, then their versions.
   */
  async items<T extends CmsContentType>(
    type: T,
    scope: LiveScope,
    ids?: CanonicalRow["id"][],
  ): Promise<Map<CanonicalRow["id"], LiveItem<SnapshotOf[T]>>> {
    const kind = contentKind(type);
    const locales = (await localeDelegate(this.prisma, type).findMany({
      where: {
        spaceId: scope.spaceId,
        languageCode: { in: [scope.languageCode, scope.defaultLanguage] },
        ...(scope.preview ? {} : { publishedRevision: { not: null } }),
        [kind.canonicalRelation]: { deletedAt: null },
        ...(ids ? { [kind.localeForeignKey]: { in: ids } } : {}),
      },
    })) as (LocaleRow & Record<string, unknown>)[];
    if (!locales.length) return new Map();

    const versions = (await versionDelegate(this.prisma, type).findMany({
      where: {
        OR: locales.map((locale) => ({
          [kind.versionForeignKey]: locale.id,
          revision: servedRevision(locale, scope.preview),
        })),
      },
    })) as (VersionRow & Record<string, unknown>)[];
    const snapshotOf = new Map(
      versions.map((version) => [
        version[kind.versionForeignKey] as string,
        version.snapshot as unknown as SnapshotOf[T] & { canonical?: unknown },
      ]),
    );

    const byItem = new Map<
      string,
      { own?: LiveItem<SnapshotOf[T]>; fallback?: LiveItem<SnapshotOf[T]> }
    >();
    for (const locale of locales) {
      const snapshot = snapshotOf.get(locale.id);
      const { firstPublishedAt, publishedAt } = servedDates(
        locale,
        scope.preview,
      );
      if (!snapshot || !firstPublishedAt || !publishedAt) continue;
      const id = locale[kind.localeForeignKey] as string;
      const entry = byItem.get(id) ?? {};
      const live = {
        id,
        languageCode: locale.languageCode,
        firstPublishedAt,
        publishedAt,
        snapshot,
      };
      if (locale.languageCode === scope.languageCode) entry.own = live;
      if (locale.languageCode === scope.defaultLanguage) entry.fallback = live;
      byItem.set(id, entry);
    }

    const result = new Map<string, LiveItem<SnapshotOf[T]>>();
    for (const [id, { own, fallback }] of byItem) {
      const served = own ?? (scope.fallback ? fallback : undefined);
      if (!served) continue;
      const canonical = (served.snapshot as { canonical?: unknown }).canonical;
      result.set(id, {
        ...served,
        snapshot:
          canonical === undefined
            ? served.snapshot
            : {
                ...served.snapshot,
                canonical: servedCanonical(
                  canonical,
                  (fallback?.snapshot as { canonical?: unknown } | undefined)
                    ?.canonical,
                ),
              },
      });
    }
    return result;
  }

  /** Live posts in one language, newest first, without their bodies. */
  blogs(
    scope: BlogScope,
    filter: BlogFilter,
    page?: { skip: number; take: number },
  ) {
    return this.queryBlogs<BlogSummarySnapshot>(scope, filter, page, false);
  }

  /** The post live at a slug in a language — the newest, should two live versions share it. */
  async blog(
    scope: BlogScope,
    slug: BlogLocale["slug"],
  ): Promise<LiveItem<BlogSnapshot>> {
    const { items } = await this.queryBlogs<BlogSnapshot>(
      scope,
      { slug },
      { skip: 0, take: 1 },
      true,
    );
    if (!items[0])
      throw new NotFoundException(
        `No post is ${scope.preview ? "saved" : "live"} at ${slug} in ${scope.languageCode}`,
      );
    return items[0];
  }

  /**
   * One post by id, with its body. The admin's preview addresses items by id: a draft's slug is not
   * unique yet (that is checked at publish), so a slug could name someone else's post.
   */
  async blogById(
    scope: BlogScope,
    id: Blog["id"],
  ): Promise<LiveItem<BlogSnapshot>> {
    const { items } = await this.queryBlogs<BlogSnapshot>(
      scope,
      { ids: [id] },
      { skip: 0, take: 1 },
      true,
    );
    if (!items[0])
      throw new NotFoundException(
        `This post has no ${scope.preview ? "saved" : "live"} ${scope.languageCode} version`,
      );
    return items[0];
  }

  /**
   * In SQL rather than through `items`, because filtering by category, tag or author has to read
   * the *served* shared fields out of the snapshots, and a list must not load every body to do
   * it. `full` keeps the body and FAQ.
   */
  private async queryBlogs<TSnapshot extends BlogSummarySnapshot>(
    scope: BlogScope,
    filter: BlogFilter,
    page: { skip: number; take: number } | undefined,
    full: boolean,
  ): Promise<{ items: LiveItem<TSnapshot>[]; total: number }> {
    // The same query either way; preview swaps which revision is joined and which dates stand in
    // (servedRevision, servedDates). Identifiers only, so Prisma.raw carries no input.
    const revision = Prisma.raw(
      scope.preview ? `"revision"` : `"publishedRevision"`,
    );
    const firstPublished = scope.preview
      ? Prisma.sql`COALESCE(l."firstPublishedAt", l."updatedAt")`
      : Prisma.sql`l."firstPublishedAt"`;
    const published = scope.preview
      ? Prisma.sql`l."updatedAt"`
      : Prisma.sql`l."publishedAt"`;

    const canonical = Prisma.sql`COALESCE(dv."snapshot"->'canonical', v."snapshot"->'canonical')`;
    const conditions = [
      Prisma.sql`l."spaceId" = ${scope.spaceId}`,
      Prisma.sql`l."languageCode" = ${scope.languageCode}`,
      Prisma.sql`l.${revision} IS NOT NULL`,
      ...(filter.ids
        ? [Prisma.sql`l."blogId" = ANY(${filter.ids}::text[])`]
        : []),
      ...(filter.slug
        ? [Prisma.sql`v."snapshot"->>'slug' = ${filter.slug}`]
        : []),
      ...(filter.categoryId
        ? [Prisma.sql`${canonical}->>'categoryId' = ${filter.categoryId}`]
        : []),
      ...(filter.tagId
        ? [
            Prisma.sql`${canonical}->'tagIds' @> jsonb_build_array(${filter.tagId}::text)`,
          ]
        : []),
      ...(filter.authorId
        ? [Prisma.sql`${canonical}->>'authorId' = ${filter.authorId}`]
        : []),
    ];

    const from = Prisma.sql`
      FROM "BlogLocale" l
      JOIN "Blog" b ON b."id" = l."blogId" AND b."deletedAt" IS NULL
      JOIN "BlogVersion" v ON v."blogLocaleId" = l."id" AND v."revision" = l.${revision}
      LEFT JOIN "BlogLocale" dl ON dl."blogId" = l."blogId"
        AND dl."languageCode" = ${scope.defaultLanguage} AND dl.${revision} IS NOT NULL
      LEFT JOIN "BlogVersion" dv ON dv."blogLocaleId" = dl."id" AND dv."revision" = dl.${revision}
      WHERE ${Prisma.join(conditions, " AND ")}`;
    const newest = full
      ? Prisma.sql`"publishedAt"`
      : Prisma.sql`"firstPublishedAt"`;

    // The page is chosen from locale columns alone; only its own rows' snapshots are then read. The
    // total is counted on its own, so a page past the end still reports how many there are.
    const [rows, counted] = await Promise.all([
      this.prisma.$queryRaw<BlogRow<TSnapshot>[]>`
        SELECT p."id", p."languageCode", p."firstPublishedAt", p."publishedAt",
          ${full ? Prisma.sql`v."snapshot"` : Prisma.sql`v."snapshot" - 'body' - 'faq' - 'provenance'`} AS "snapshot",
          COALESCE(dv."snapshot"->'canonical', v."snapshot"->'canonical') AS "canonical"
        FROM (
          SELECT l."blogId" AS "id", l."id" AS "localeId", l."languageCode",
            ${firstPublished} AS "firstPublishedAt", ${published} AS "publishedAt",
            v."id" AS "versionId", dv."id" AS "defaultVersionId"
          ${from}
          ORDER BY ${full ? published : firstPublished} DESC, l."id"
          ${page ? Prisma.sql`LIMIT ${page.take} OFFSET ${page.skip}` : Prisma.empty}
        ) p
        JOIN "BlogVersion" v ON v."id" = p."versionId"
        LEFT JOIN "BlogVersion" dv ON dv."id" = p."defaultVersionId"
        ORDER BY p.${newest} DESC, p."localeId"
      `,
      page
        ? this.prisma.$queryRaw<{ total: number }[]>`
            SELECT COUNT(*)::int AS "total" ${from}
          `
        : undefined,
    ]);

    return {
      total: counted ? counted[0].total : rows.length,
      items: rows.map((row) => ({
        id: row.id,
        languageCode: row.languageCode,
        firstPublishedAt: row.firstPublishedAt,
        publishedAt: row.publishedAt,
        snapshot: { ...row.snapshot, canonical: row.canonical },
      })),
    };
  }

  /** Live posts by id in a language, falling back to the default language for the rest. */
  async blogsWithFallback(
    scope: BlogScope,
    ids: Blog["id"][],
  ): Promise<Map<Blog["id"], LiveItem<BlogSummarySnapshot>>> {
    const found = new Map<Blog["id"], LiveItem<BlogSummarySnapshot>>();
    if (!ids.length) return found;
    for (const item of (await this.blogs(scope, { ids })).items)
      found.set(item.id, item);
    const missing = ids.filter((id) => !found.has(id));
    if (missing.length && scope.languageCode !== scope.defaultLanguage)
      for (const item of (
        await this.blogs(
          { ...scope, languageCode: scope.defaultLanguage },
          { ids: missing },
        )
      ).items)
        found.set(item.id, item);
    return found;
  }

  /** The other languages a post is live in, with the slug each serves it at — for hreflang. */
  blogAlternates(
    blogId: Blog["id"],
    languageCodes: SiteLanguage["code"][],
    preview = false,
  ): Promise<
    { languageCode: BlogLocale["languageCode"]; slug: BlogLocale["slug"] }[]
  > {
    const revision = Prisma.raw(preview ? `"revision"` : `"publishedRevision"`);
    return this.prisma.$queryRaw`
      SELECT l."languageCode", v."snapshot"->>'slug' AS "slug"
      FROM "BlogLocale" l
      JOIN "BlogVersion" v ON v."blogLocaleId" = l."id" AND v."revision" = l.${revision}
      WHERE l."blogId" = ${blogId} AND l."languageCode" = ANY(${languageCodes}::text[])
      ORDER BY l."languageCode"
    `;
  }

  /** The other enabled languages an item is live in — or, in preview, saved in. */
  async liveLanguages(
    type: CmsContentType,
    itemId: CanonicalRow["id"],
    languageCodes: SiteLanguage["code"][],
    preview = false,
  ): Promise<SiteLanguage["code"][]> {
    const locales = await localeDelegate(this.prisma, type).findMany({
      where: {
        [contentKind(type).localeForeignKey]: itemId,
        languageCode: { in: languageCodes },
        ...(preview ? {} : { publishedRevision: { not: null } }),
      },
    });
    return locales.map((locale) => locale.languageCode);
  }
}
