import {
  type Author,
  type Blog,
  type BlogLocale,
  CmsContentType,
  type Prisma,
  type Site,
} from "@loom/database";
import type {
  ContentListItemResponseDto,
  ContentListResponseDto,
  ListContentRequestDto,
} from "@loom/dto";
import { listDefaults } from "@loom/dto";
import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  type ContentDelegate,
  type ContentKind,
  contentKind,
} from "./content-kind.registry";

/** A canonical row with its locales loaded, which is all the list projection needs. */
interface ListableRow {
  id: Blog["id"];
  updatedAt: Blog["updatedAt"];
  deletedAt: Blog["deletedAt"];
  slug?: BlogLocale["slug"];
  /** Present only for kinds whose identity is canonical — see ContentKind.canonicalTitleField. */
  name?: Author["name"];
  locales: Record<string, unknown>[];
}

@Injectable()
export class ContentQueryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The list behind every content table: search, status filter, sort and pagination, projected to
   * one row per canonical item with all of its locales attached.
   *
   * Search runs against the requested language's locale columns with `mode: "insensitive"` rather
   * than a tsvector: Postgres has no text configuration for most of the 21 languages, so a shared
   * `contains` keeps Arabic and Japanese behaving the same as English.
   */
  async list(
    type: CmsContentType,
    query: ListContentRequestDto,
    defaultLanguage: Site["defaultLanguage"],
  ): Promise<ContentListResponseDto> {
    const kind = contentKind(type);
    const page = query.page ?? listDefaults.page;
    const pageSize = query.pageSize ?? listDefaults.pageSize;
    const sort = query.sort ?? listDefaults.sort;
    const direction = query.direction ?? listDefaults.direction;

    const where = this.buildWhere(type, query);
    // The registry cannot know each type's row shape; this consumer does, so the narrowing happens
    // here rather than as `as never` on every argument
    const delegate = kind.canonical(
      this.prisma,
    ) as ContentDelegate<ListableRow>;

    const [rows, total] = await Promise.all([
      delegate.findMany({
        where,
        select: this.buildSelect(kind),
        // `title` is a locale column, so sorting by it has to happen after projection
        orderBy:
          sort === "title" ? { updatedAt: "desc" } : { [sort]: direction },
        skip: sort === "title" ? undefined : (page - 1) * pageSize,
        take: sort === "title" ? undefined : pageSize,
      }),
      delegate.count({ where }),
    ]);

    let items = rows.map((row) =>
      this.toListItem(row, query, defaultLanguage, kind),
    );

    if (sort === "title") {
      items.sort((a, b) =>
        direction === "asc"
          ? a.title.localeCompare(b.title)
          : b.title.localeCompare(a.title),
      );
      items = items.slice((page - 1) * pageSize, page * pageSize);
    }

    return {
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  /**
   * Only what the projection reads. With `include: { locales: true }` a BLOG list pulled the full
   * Tiptap `body`, `summary` and `faq` for every locale of every row — 21 documents per row — and
   * the serializer then dropped all of it, so the cost was invisible between Postgres and Nest.
   */
  private buildSelect(kind: ContentKind) {
    const localeFields: Record<string, boolean> = {
      languageCode: true,
      status: true,
      revision: true,
      sourceRevision: true,
      contentRevision: true,
      publishedRevision: true,
      updatedAt: true,
      publishedAt: true,
      [kind.titleField]: true,
    };
    if (kind.slugScope === "locale") localeFields.slug = true;

    const canonicalFields: Record<string, unknown> = {
      id: true,
      updatedAt: true,
      deletedAt: true,
      locales: { select: localeFields },
    };
    if (kind.slugScope === "canonical") canonicalFields.slug = true;
    if (kind.canonicalTitleField)
      canonicalFields[kind.canonicalTitleField] = true;

    return canonicalFields;
  }

  private buildWhere(
    type: CmsContentType,
    query: ListContentRequestDto,
  ): Prisma.BlogWhereInput {
    const kind = contentKind(type);

    const localeFilters: Record<string, unknown>[] = [];
    if (query.status) localeFilters.push({ status: query.status });
    if (query.submittedById)
      localeFilters.push({ submittedById: query.submittedById });

    if (query.q && kind.searchableLocaleFields.length)
      localeFilters.push({
        OR: kind.searchableLocaleFields.map((field) => ({
          [field]: { contains: query.q, mode: "insensitive" },
        })),
      });

    const localeMatch = localeFilters.length
      ? {
          locales: {
            some: { languageCode: query.language, AND: localeFilters },
          },
        }
      : {};

    // Author identity is canonical, so a name search has to reach the canonical row as well as
    // the locale one — otherwise searching Authors by name returns nothing
    const canonicalMatch =
      query.q && kind.searchableCanonicalFields?.length
        ? {
            OR: kind.searchableCanonicalFields.map((field) => ({
              [field]: { contains: query.q, mode: "insensitive" },
            })),
          }
        : undefined;

    const postFilters = query.categoryId || query.authorId || query.tagId;
    if (postFilters && type !== CmsContentType.BLOG)
      throw new BadRequestException(
        "Only posts have a category, an author and tags to filter by",
      );

    const base = {
      spaceId: query.spaceId,
      // Trash has its own screen; a content list shows what is live
      deletedAt: null,
      ...(query.updatedFrom || query.updatedTo
        ? {
            updatedAt: {
              ...(query.updatedFrom
                ? { gte: new Date(query.updatedFrom) }
                : {}),
              ...(query.updatedTo ? { lt: new Date(query.updatedTo) } : {}),
            },
          }
        : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.authorId ? { authorId: query.authorId } : {}),
      ...(query.tagId ? { tags: { some: { tagId: query.tagId } } } : {}),
    };

    // A canonical hit and a locale hit are alternatives, not requirements
    if (canonicalMatch)
      return {
        ...base,
        OR: [canonicalMatch, ...(localeFilters.length ? [localeMatch] : [])],
      } as Prisma.BlogWhereInput;

    return { ...base, ...localeMatch } as Prisma.BlogWhereInput;
  }

  /**
   * Falls back to the default language for the title so an untranslated row is still identifiable
   * in the list. `hasRequestedLocale` is what tells the table which case it is rendering.
   */
  private toListItem(
    row: ListableRow,
    query: ListContentRequestDto,
    defaultLanguage: Site["defaultLanguage"],
    kind: ContentKind,
  ): ContentListItemResponseDto {
    const requested = row.locales.find(
      (locale) => locale.languageCode === query.language,
    );
    const fallback = row.locales.find(
      (locale) => locale.languageCode === defaultLanguage,
    );
    const source = requested ?? fallback;

    // A canonical title wins, because for Author the locale row holds a job title and nothing that
    // identifies the person
    const title = kind.canonicalTitleField
      ? row[kind.canonicalTitleField as keyof ListableRow]
      : source?.[kind.titleField];

    return {
      id: row.id,
      title: String(title ?? "Untitled"),
      slug: String(row.slug ?? source?.slug ?? ""),
      hasRequestedLocale: Boolean(requested),
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
      locales: row.locales.map((locale) => ({
        languageCode: String(locale.languageCode),
        status: locale.status,
        revision: Number(locale.revision),
        sourceRevision: locale.sourceRevision,
        contentRevision: Number(locale.contentRevision),
        publishedRevision: locale.publishedRevision,
        updatedAt: locale.updatedAt,
        publishedAt: locale.publishedAt,
      })) as ContentListItemResponseDto["locales"],
    };
  }
}
