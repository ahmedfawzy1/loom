import type { BlogLocale } from "@loom/database";
import { Expose } from "class-transformer";

/** Where one language stands against the default language, across every translatable item. */
export class DashboardTranslationGapResponseDto {
  @Expose()
  languageCode: BlogLocale["languageCode"];

  /** Items the default language has and this one does not. */
  @Expose()
  missing: number;

  /** Made from default-language text that has changed since. */
  @Expose()
  stale: number;

  /** Nothing records what it was made from, so it cannot show as Stale. */
  @Expose()
  untracked: number;
}
