import type {
  Blog,
  BlogLocale,
  FeaturedArticlesLocale,
  Prisma,
} from "@loom/database";

type RawClient = Pick<Prisma.TransactionClient, "$queryRaw">;

export interface EmbeddingBody {
  blogId: BlogLocale["blogId"];
  title: BlogLocale["title"];
  languageCode: BlogLocale["languageCode"];
  deletedAt: Blog["deletedAt"];
}

/**
 * Every post body that mentions an id — images, CTAs and entries embedded in Tiptap JSON, where no
 * foreign key can see them. Ids are cuids, so a text match on the serialised document is exact in
 * practice. Current bodies only; `liveBlogVersionsContaining` covers what the website serves.
 */
export function blogBodiesContaining(
  client: RawClient,
  id: string,
): Promise<EmbeddingBody[]> {
  return client.$queryRaw<EmbeddingBody[]>`
    SELECT locale."blogId", locale."title", locale."languageCode", blog."deletedAt"
    FROM "BlogLocale" locale
    JOIN "Blog" blog ON blog."id" = locale."blogId"
    WHERE locale."body"::text LIKE ${`%${id}%`}
  `;
}

/**
 * Every published post version that mentions an id, anywhere — its body or its shared fields. This
 * is what readers see, and it can differ from the working row: an edit waiting to be published
 * may already have moved the byline or removed the embed that the live page still shows.
 */
export function liveBlogVersionsContaining(
  client: RawClient,
  id: string,
): Promise<EmbeddingBody[]> {
  return client.$queryRaw<EmbeddingBody[]>`
    SELECT locale."blogId", locale."title", locale."languageCode", blog."deletedAt"
    FROM "BlogVersion" version
    JOIN "BlogLocale" locale
      ON locale."id" = version."blogLocaleId" AND locale."publishedRevision" = version."revision"
    JOIN "Blog" blog ON blog."id" = locale."blogId"
    WHERE version."snapshot"::text LIKE ${`%${id}%`}
  `;
}

/** Every Featured Articles language listing a post, in its working list or its live one. */
export function featuredListsContaining(
  client: RawClient,
  blogId: Blog["id"],
): Promise<Pick<FeaturedArticlesLocale, "languageCode">[]> {
  return client.$queryRaw<Pick<FeaturedArticlesLocale, "languageCode">[]>`
    SELECT DISTINCT locale."languageCode"
    FROM "FeaturedArticlesLocale" locale
    LEFT JOIN "FeaturedArticlesVersion" version
      ON version."featuredArticlesLocaleId" = locale."id"
      AND version."revision" = locale."publishedRevision"
    WHERE version."snapshot"::text LIKE ${`%${blogId}%`}
      OR EXISTS (
        SELECT 1 FROM "FeaturedArticlesItem" item
        WHERE item."localeId" = locale."id" AND item."blogId" = ${blogId}
      )
  `;
}
