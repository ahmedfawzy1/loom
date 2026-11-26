import type { Blog, BlogLocale } from "@loom/database";
import { Expose } from "class-transformer";

/** A live post that uses an item — what unpublishing or trashing that item takes from it. */
export class LiveUsageResponseDto {
  @Expose()
  id: Blog["id"];

  @Expose()
  title: BlogLocale["title"];

  @Expose()
  languageCodes: BlogLocale["languageCode"][];
}
