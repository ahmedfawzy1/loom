import { CmsContentType, Prisma } from "@loom/database";
import type { SearchRequestDto, SearchResultResponseDto } from "@loom/dto";
import { SEARCH_MAX_RESULTS } from "@loom/dto/constants";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SEARCH_FUZZY_THRESHOLD } from "./search.constants";

interface Hit {
  type: CmsContentType;
  id: string;
  title: string;
  languageCode: string;
  slug: string | null;
}

/** A search term for LIKE, with its own `%`, `_` and `\` taken literally. */
const escapeLike = (q: string) => q.replace(/[\\%_]/g, "\\$&");

/**
 * The global search: every language of posts, categories, tags, authors and CTAs in one
 * Space. Titles are matched with pg_trgm — as a substring, or fuzzily, so a typo still
 * finds the post — and the other short text fields as a substring. Bodies are not searched.
 *
 * Ranked exact, then prefix, then substring, then by trigram word similarity. Each item appears
 * once, in the language it matched best — the one being worked in when it matched there.
 */
@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(query: SearchRequestDto): Promise<SearchResultResponseDto[]> {
    const q = query.q.trim();
    const like = `%${escapeLike(q)}%`;
    const prefix = `${escapeLike(q)}%`;

    // How well a title matches, shared by every branch
    const titleScore = (title: Prisma.Sql) => Prisma.sql`
      CASE
        WHEN lower(${title}) = lower(${q}) THEN 4
        WHEN ${title} ILIKE ${prefix} THEN 3
        WHEN ${title} ILIKE ${like} THEN 2
        ELSE word_similarity(${q}, ${title})
      END`;
    // Both halves are operators the trigram index serves; `<%` uses the threshold set below
    const titleMatches = (title: Prisma.Sql) =>
      Prisma.sql`(${title} ILIKE ${like} OR ${q} <% ${title})`;
    // A hit only on a field other than the title ranks below every title hit
    const otherMatch = (...fields: Prisma.Sql[]) =>
      Prisma.join(
        fields.map((field) => Prisma.sql`coalesce(${field}, '') ILIKE ${like}`),
        " OR ",
      );
    const scored = (title: Prisma.Sql) =>
      Prisma.sql`CASE WHEN ${titleMatches(title)} THEN ${titleScore(title)} ELSE 0.5 END`;
    const localeTitle = Prisma.sql`l."title"`;

    // The operator's default threshold of 0.6 misses a single transposed letter ("godyl" scores
    // 0.5 against "Godly knife"); set for this transaction only, on the query's own connection
    const [, hits] = await this.prisma.$transaction([
      this.prisma
        .$executeRaw`SELECT set_config('pg_trgm.word_similarity_threshold', ${String(SEARCH_FUZZY_THRESHOLD)}, true)`,
      this.prisma.$queryRaw<Hit[]>`
      SELECT "type", "id", "title", "languageCode", "slug" FROM (
      SELECT DISTINCT ON ("type", "id")
        "type", "id", "title", "languageCode", "slug", "score"::float8 AS "score"
      FROM (
        SELECT ${CmsContentType.BLOG}::text AS "type", b."id", l."title", l."languageCode",
          l."slug", ${scored(localeTitle)} AS "score"
        FROM "BlogLocale" l JOIN "Blog" b ON b."id" = l."blogId"
        WHERE l."spaceId" = ${query.spaceId} AND b."deletedAt" IS NULL
          AND (${titleMatches(localeTitle)} OR ${otherMatch(Prisma.sql`l."description"`, Prisma.sql`l."slug"`)})
        UNION ALL
        SELECT ${CmsContentType.CATEGORY}::text, c."id", l."title", l."languageCode", c."slug",
          ${scored(localeTitle)}
        FROM "CategoryLocale" l JOIN "Category" c ON c."id" = l."categoryId"
        WHERE l."spaceId" = ${query.spaceId} AND c."deletedAt" IS NULL
          AND (${titleMatches(localeTitle)} OR ${otherMatch(Prisma.sql`l."description"`, Prisma.sql`c."slug"`)})
        UNION ALL
        SELECT ${CmsContentType.TAG}::text, t."id", l."title", l."languageCode", t."slug",
          ${scored(localeTitle)}
        FROM "TagLocale" l JOIN "Tag" t ON t."id" = l."tagId"
        WHERE l."spaceId" = ${query.spaceId} AND t."deletedAt" IS NULL
          AND (${titleMatches(localeTitle)} OR ${otherMatch(Prisma.sql`l."description"`, Prisma.sql`t."slug"`)})
        UNION ALL
        SELECT ${CmsContentType.CTA}::text, c."id", l."title", l."languageCode", NULL,
          ${scored(localeTitle)}
        FROM "CtaLocale" l JOIN "Cta" c ON c."id" = l."ctaId"
        WHERE l."spaceId" = ${query.spaceId} AND c."deletedAt" IS NULL
          AND (${titleMatches(localeTitle)} OR ${otherMatch(Prisma.sql`l."description"`, Prisma.sql`l."buttonLabel"`, Prisma.sql`c."cmpid"`)})
        UNION ALL
        -- An author is named once, canonically, so it matches in every language
        SELECT ${CmsContentType.AUTHOR}::text, a."id", a."name", ${query.language}::text, NULL,
          ${titleScore(Prisma.sql`a."name"`)}
        FROM "Author" a
        WHERE a."spaceId" = ${query.spaceId} AND a."deletedAt" IS NULL
          AND ${titleMatches(Prisma.sql`a."name"`)}
      ) hits
      ORDER BY "type", "id", ("languageCode" = ${query.language}) DESC, "score" DESC
      ) best
      ORDER BY "score" DESC
      LIMIT ${SEARCH_MAX_RESULTS}
    `,
    ]);
    return hits;
  }
}
