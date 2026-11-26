import type { BlogLocale } from "@loom/database";
import { Expose } from "class-transformer";
import type { RichTextEntryType } from "../../constants/rich-text.constants";

/**
 * Where an entry link in a body points. A post's slug is per language; a category's or tag's is
 * shared; an author has none, so the website builds that URL from the id or name it already has.
 */
export class DeliveryEntryLinkResponseDto {
  @Expose()
  type: RichTextEntryType;

  @Expose()
  id: string;

  @Expose()
  languageCode: BlogLocale["languageCode"];

  @Expose()
  slug: string | null;

  @Expose()
  title: string;
}
