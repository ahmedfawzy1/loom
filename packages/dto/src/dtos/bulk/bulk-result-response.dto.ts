import type { SiteLanguage } from "@loom/database";
import { Expose } from "class-transformer";

/** What happened to one item, in one language for a per-language action. */
export class BulkResultResponseDto {
  @Expose()
  id: string;

  @Expose()
  title: string;

  @Expose()
  languageCode: SiteLanguage["code"] | null;

  @Expose()
  outcome: "done" | "skipped" | "failed";

  @Expose()
  message: string | null;
}
