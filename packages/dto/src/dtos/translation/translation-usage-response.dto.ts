import type { TranslationUsage } from "@loom/database";
import { Expose } from "class-transformer";

/** DeepL characters this Site has used this month. */
export class TranslationUsageResponseDto {
  @Expose()
  characters: TranslationUsage["characters"];

  /** The start of the month counted, in UTC. */
  @Expose()
  since: TranslationUsage["createdAt"];
}
