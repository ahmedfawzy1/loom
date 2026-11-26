import {
  AuditAction,
  CmsContentType,
  type LocaleStatus,
  Prisma,
} from "@loom/database";
import type {
  DashboardRequestDto,
  DashboardResponseDto,
  DashboardTranslationGapResponseDto,
} from "@loom/dto";
import { Injectable } from "@nestjs/common";
import { ActivityService } from "../activity/activity.service";
import { ContentContextService } from "../content/content-context.service";
import { contentKind } from "../content/content-kind.registry";
import { PrismaService } from "../prisma/prisma.service";
import { TranslationService } from "../translation/translation.service";
import { DASHBOARD_RECENT_EDITS } from "./dashboard.constants";

// The types with text in every language — a Featured Articles list is ids, and has nothing to count
const COUNTED_TYPES = Object.values(CmsContentType).filter(
  (type) => contentKind(type).translation,
);

// What "recent edits" means: a change to the text, not a change of publish state
const EDIT_ACTIONS = [
  AuditAction.CONTENT_CREATED,
  AuditAction.CONTENT_EDITED,
  AuditAction.CONTENT_TRANSLATED,
  AuditAction.CONTENT_DUPLICATED,
  AuditAction.VERSION_RESTORED,
];

/** The tables of one type, named for SQL. */
const tablesOf = (type: CmsContentType) => {
  const kind = contentKind(type);
  return {
    canonical: Prisma.raw(`"${kind.canonicalTable}"`),
    locale: Prisma.raw(`"${kind.localeTable}"`),
    foreignKey: Prisma.raw(`"${kind.localeForeignKey}"`),
  };
};

/** The CMS home: where the Space stands, in the language being worked in. */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: ContentContextService,
    private readonly activity: ActivityService,
    private readonly translation: TranslationService,
  ) {}

  async get(query: DashboardRequestDto): Promise<DashboardResponseDto> {
    const { space } = await this.context.requireLanguage(
      query.spaceId,
      query.language,
    );
    const defaultLanguage = space.site.defaultLanguage;
    const otherLanguages = space.site.languages
      .filter(
        (language) => language.enabled && language.code !== defaultLanguage,
      )
      .sort((a, b) => a.position - b.position)
      .map((language) => language.code);

    const [statusCounts, missing, translations, recent, deeplUsage] =
      await Promise.all([
        this.statusCounts(query.spaceId, query.language),
        this.missingIn(query.spaceId, query.language),
        this.translationGaps(query.spaceId, defaultLanguage, otherLanguages),
        this.prisma.auditLog.findMany({
          where: { spaceId: query.spaceId, action: { in: EDIT_ACTIONS } },
          orderBy: { createdAt: "desc" },
          take: DASHBOARD_RECENT_EDITS,
        }),
        this.translation.usage(space.siteId),
      ]);

    return {
      statusCounts,
      missing,
      translations,
      recentEdits: await this.activity.entries(recent, query.language),
      deeplUsage,
    };
  }

  /** Every item in the language, by type and status — Trash excluded, since the website serves none of it. */
  private statusCounts(
    spaceId: string,
    languageCode: string,
  ): Promise<{ type: CmsContentType; status: LocaleStatus; count: number }[]> {
    const branches = COUNTED_TYPES.map((type) => {
      const t = tablesOf(type);
      return Prisma.sql`
        SELECT ${type}::text AS "type", l."status"::text AS "status", COUNT(*)::int AS "count"
        FROM ${t.locale} l JOIN ${t.canonical} c ON c."id" = l.${t.foreignKey} AND c."deletedAt" IS NULL
        WHERE l."spaceId" = ${spaceId} AND l."languageCode" = ${languageCode}
        GROUP BY l."status"`;
    });
    return this.prisma.$queryRaw`${Prisma.join(branches, " UNION ALL ")}`;
  }

  /** Items with no version at all in the language, by type. */
  private missingIn(
    spaceId: string,
    languageCode: string,
  ): Promise<{ type: CmsContentType; count: number }[]> {
    const branches = COUNTED_TYPES.map((type) => {
      const t = tablesOf(type);
      return Prisma.sql`
        SELECT ${type}::text AS "type", COUNT(*)::int AS "count" FROM ${t.canonical} c
        WHERE c."spaceId" = ${spaceId} AND c."deletedAt" IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM ${t.locale} l
            WHERE l.${t.foreignKey} = c."id" AND l."languageCode" = ${languageCode}
          )`;
    });
    return this.prisma.$queryRaw`${Prisma.join(branches, " UNION ALL ")}`;
  }

  /**
   * For every other language, what it lacks against the default one: items it has no version of,
   * versions made from default-language text that has changed since (translationState's Stale),
   * and versions that record nothing (Untracked). Items with no default-language version have no
   * source, and are left out.
   */
  private async translationGaps(
    spaceId: string,
    defaultLanguage: string,
    languages: string[],
  ): Promise<DashboardTranslationGapResponseDto[]> {
    if (!languages.length) return [];
    const branches = COUNTED_TYPES.map((type) => {
      const t = tablesOf(type);
      return Prisma.sql`
        SELECT lang."code" AS "languageCode",
          COUNT(*) FILTER (WHERE l."id" IS NULL)::int AS "missing",
          COUNT(*) FILTER (WHERE l."sourceRevision" < d."contentRevision")::int AS "stale",
          COUNT(*) FILTER (WHERE l."id" IS NOT NULL AND l."sourceRevision" IS NULL)::int AS "untracked"
        FROM ${t.canonical} c
        JOIN ${t.locale} d ON d.${t.foreignKey} = c."id" AND d."languageCode" = ${defaultLanguage}
        CROSS JOIN unnest(${languages}::text[]) AS lang("code")
        LEFT JOIN ${t.locale} l ON l.${t.foreignKey} = c."id" AND l."languageCode" = lang."code"
        WHERE c."spaceId" = ${spaceId} AND c."deletedAt" IS NULL
        GROUP BY lang."code"`;
    });
    const rows = await this.prisma.$queryRaw<
      DashboardTranslationGapResponseDto[]
    >`
      SELECT "languageCode", SUM("missing")::int AS "missing", SUM("stale")::int AS "stale",
        SUM("untracked")::int AS "untracked"
      FROM (${Prisma.join(branches, " UNION ALL ")}) gaps
      GROUP BY "languageCode"
    `;
    const byCode = new Map(rows.map((row) => [row.languageCode, row]));
    // In the Site's language order, and every language listed even with nothing in the Space
    return languages.map(
      (languageCode) =>
        byCode.get(languageCode) ?? {
          languageCode,
          missing: 0,
          stale: 0,
          untracked: 0,
        },
    );
  }
}
