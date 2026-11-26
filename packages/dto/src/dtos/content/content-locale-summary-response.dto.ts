import type { BlogLocale } from "@loom/database";
import { Expose } from "class-transformer";

/**
 * What a list row shows about one locale. Every content type's locale carries these, so the shape
 * is shared rather than repeated six times.
 */
export class ContentLocaleSummaryResponseDto {
  @Expose()
  languageCode: BlogLocale["languageCode"];

  @Expose()
  status: BlogLocale["status"];

  @Expose()
  revision: BlogLocale["revision"];

  @Expose()
  sourceRevision: BlogLocale["sourceRevision"];

  /** Compared with a translation's sourceRevision to tell whether it is Stale — see translationState. */
  @Expose()
  contentRevision: BlogLocale["contentRevision"];

  /** The revision the website serves, or null when nothing is live — status alone cannot say. */
  @Expose()
  publishedRevision: BlogLocale["publishedRevision"];

  @Expose()
  updatedAt: BlogLocale["updatedAt"];

  @Expose()
  publishedAt: BlogLocale["publishedAt"];
}
