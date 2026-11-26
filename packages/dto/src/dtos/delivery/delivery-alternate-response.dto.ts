import type { BlogLocale } from "@loom/database";
import { Expose } from "class-transformer";

/** Another language the same item is live in, and the slug it is served at there — for hreflang. */
export class DeliveryAlternateResponseDto {
  @Expose()
  languageCode: BlogLocale["languageCode"];

  @Expose()
  slug: BlogLocale["slug"];
}
