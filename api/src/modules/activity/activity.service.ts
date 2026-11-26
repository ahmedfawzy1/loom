import type { AuditLog, Prisma, SiteLanguage } from "@loom/database";
import type {
  ActivityEntryResponseDto,
  ActivityListResponseDto,
  ListActivityRequestDto,
} from "@loom/dto";
import { Injectable } from "@nestjs/common";
import {
  type ContentRef,
  contentTitles,
  refKey,
} from "../content/content-titles.util";
import { PrismaService } from "../prisma/prisma.service";
import { ACTIVITY_DEFAULT_PAGE_SIZE } from "./activity.constants";

/** The Activity log: every audit entry, newest first, kept forever. */
@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListActivityRequestDto): Promise<ActivityListResponseDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? ACTIVITY_DEFAULT_PAGE_SIZE;
    const where: Prisma.AuditLogWhereInput = {
      spaceId: query.spaceId,
      userId: query.userId,
      action: query.action,
      contentType: query.contentType,
      contentId: query.contentId,
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lt: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items: await this.entries(rows, query.language),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  /** Entries with their item's name and their Space's, as the log and the dashboard show them. */
  async entries(
    rows: AuditLog[],
    language: SiteLanguage["code"],
  ): Promise<ActivityEntryResponseDto[]> {
    const refs = rows.flatMap((row): ContentRef[] =>
      row.contentType && row.contentId
        ? [{ type: row.contentType, id: row.contentId }]
        : [],
    );
    const spaceIds = [
      ...new Set(rows.flatMap((row) => (row.spaceId ? [row.spaceId] : []))),
    ];
    const [titles, spaces] = await Promise.all([
      contentTitles(this.prisma, refs, language),
      this.prisma.space.findMany({
        where: { id: { in: spaceIds } },
        select: { id: true, name: true },
      }),
    ]);
    const spaceNames = new Map(spaces.map((space) => [space.id, space.name]));

    return rows.map((row) => ({
      ...row,
      contentTitle:
        row.contentType && row.contentId
          ? (titles.get(refKey({ type: row.contentType, id: row.contentId })) ??
            null)
          : null,
      spaceName: row.spaceId ? (spaceNames.get(row.spaceId) ?? null) : null,
    }));
  }
}
