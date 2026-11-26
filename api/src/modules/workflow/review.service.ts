import {
  type BlogLocale,
  CmsContentType,
  CmsRole,
  LocaleStatus,
  type Space,
} from "@loom/database";
import type { ReviewQueueItemResponseDto } from "@loom/dto";
import { Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/auth.types";
import type { CanonicalRow, LocaleRow } from "../content/content-item.util";
import { contentKind } from "../content/content-kind.registry";
import { contentTitle } from "../content/content-title.util";
import { PrismaService } from "../prisma/prisma.service";

// A Writer's own history is capped; the reviewer queue is not, since everything in it needs acting on
const WRITER_HISTORY_LIMIT = 50;

type QueueRow = LocaleRow &
  Record<string, unknown> & {
    submittedBy: ReviewQueueItemResponseDto["submittedBy"];
  };

@Injectable()
export class ReviewService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Admins and Authors get everything In Review in the Space. A Writer gets their own submissions
   * and where each one stands, including any note asking for changes.
   */
  async queue(
    actor: AuthenticatedUser,
    spaceId: Space["id"],
  ): Promise<ReviewQueueItemResponseDto[]> {
    const isWriter = actor.role === CmsRole.WRITER;

    const groups = await Promise.all(
      Object.values(CmsContentType).map(async (type) => {
        const kind = contentKind(type);
        const rows = (await kind.locale(this.prisma).findMany({
          where: {
            spaceId,
            [kind.canonicalRelation]: { deletedAt: null },
            ...(isWriter
              ? { submittedById: actor.id }
              : { status: LocaleStatus.IN_REVIEW }),
          },
          include: {
            [kind.canonicalRelation]: true,
            submittedBy: { select: { id: true, email: true, name: true } },
          },
        })) as QueueRow[];

        return rows.map((row) => ({
          type,
          id: (row[kind.canonicalRelation] as CanonicalRow).id,
          title: contentTitle(
            type,
            row[kind.canonicalRelation] as Record<string, unknown>,
            row,
          ),
          languageCode: row.languageCode,
          status: row.status,
          submittedAt: row.submittedAt,
          submittedBy: row.submittedBy,
          reviewNote: row.reviewNote,
        }));
      }),
    );

    const items = groups.flat();
    const at = (item: { submittedAt: BlogLocale["submittedAt"] }) =>
      item.submittedAt?.getTime() ?? 0;

    // Reviewers work oldest-first; a Writer looks for what just happened to their latest
    return isWriter
      ? items.sort((a, b) => at(b) - at(a)).slice(0, WRITER_HISTORY_LIMIT)
      : items.sort((a, b) => at(a) - at(b));
  }
}
