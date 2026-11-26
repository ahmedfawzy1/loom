import type { BlogLocale } from "@loom/database";
import { Expose } from "class-transformer";
import { ContentLocaleSummaryResponseDto } from "./content-locale-summary-response.dto";

/**
 * A locale's publish and review state, as the editor needs it: the list row's fields plus who
 * submitted it and what the reviewer said. Every type's locale response extends this.
 */
export class LocaleStateResponseDto extends ContentLocaleSummaryResponseDto {
  @Expose()
  firstPublishedAt: BlogLocale["firstPublishedAt"];

  @Expose()
  submittedById: BlogLocale["submittedById"];

  @Expose()
  submittedAt: BlogLocale["submittedAt"];

  /** Set when a reviewer requests changes; shown in the editor until the next submission. */
  @Expose()
  reviewNote: BlogLocale["reviewNote"];

  @Expose()
  reviewedAt: BlogLocale["reviewedAt"];
}
