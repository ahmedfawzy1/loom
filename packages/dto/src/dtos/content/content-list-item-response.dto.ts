import type { Blog } from "@loom/database";
import { Expose, Type } from "class-transformer";
import { ContentLocaleSummaryResponseDto } from "./content-locale-summary-response.dto";

/**
 * One row in a content table. The title comes from the requested language when that locale exists
 * and from the default language otherwise, so a row is never blank just because it is untranslated
 * — `hasRequestedLocale` is what tells the table which case it is looking at.
 */
export class ContentListItemResponseDto {
  @Expose()
  id: Blog["id"];

  @Expose()
  title: string;

  @Expose()
  slug: string;

  @Expose()
  hasRequestedLocale: boolean;

  @Expose()
  updatedAt: Blog["updatedAt"];

  @Expose()
  deletedAt: Blog["deletedAt"];

  /** Every language this item exists in, for the translation-status matrix. */
  @Expose()
  @Type(() => ContentLocaleSummaryResponseDto)
  locales: ContentLocaleSummaryResponseDto[];
}
