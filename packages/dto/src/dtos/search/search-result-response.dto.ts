import type { BlogLocale, CmsContentType } from "@loom/database";
import { Expose } from "class-transformer";

/** One item a global search found, in the language it matched best. */
export class SearchResultResponseDto {
  @Expose()
  type: CmsContentType;

  @Expose()
  id: string;

  @Expose()
  title: string;

  @Expose()
  languageCode: BlogLocale["languageCode"];

  @Expose()
  slug: string | null;
}
