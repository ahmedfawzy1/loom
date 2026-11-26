import type {
  CmsContentType,
  LocaleStatus,
  SiteLanguage,
} from "@loom/database";
import { Expose } from "class-transformer";

export const BLOCKING_REASONS = ["missing", "trashed", "unpublished"] as const;
export type BlockingReason = (typeof BLOCKING_REASONS)[number];

/**
 * Something a version refers to that the website could not serve with it, so publishing it is
 * refused. An unpublished one names the language it can be published in to clear the way.
 */
export class BlockingReferenceResponseDto {
  @Expose()
  type: CmsContentType;

  @Expose()
  id: string;

  @Expose()
  title: string;

  @Expose()
  reason: BlockingReason;

  /** Where publishing it would unblock this one — null when it has no version there to publish. */
  @Expose()
  publishIn: SiteLanguage["code"] | null;

  /** Its status in `publishIn` — what publishing it puts live: a draft, or a submission it approves. */
  @Expose()
  status: LocaleStatus | null;
}
