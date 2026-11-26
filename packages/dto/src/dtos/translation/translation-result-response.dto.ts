import type { SiteLanguage, TranslationUsage } from "@loom/database";
import { Expose } from "class-transformer";

export const TRANSLATION_OUTCOMES = [
  "translated",
  "unchanged",
  "failed",
] as const;
export type TranslationOutcome = (typeof TRANSLATION_OUTCOMES)[number];

/** What happened to one language of a translate request. Each language succeeds or fails alone. */
export class TranslationResultResponseDto {
  @Expose()
  languageCode: SiteLanguage["code"];

  /** `unchanged` when nothing in the source changed since this language was last translated. */
  @Expose()
  outcome: TranslationOutcome;

  /** Characters sent to DeepL, which is what it bills. */
  @Expose()
  characters: TranslationUsage["characters"];

  @Expose()
  message: string | null;
}
