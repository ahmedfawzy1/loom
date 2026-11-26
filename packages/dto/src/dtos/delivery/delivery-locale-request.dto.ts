import type { SiteLanguage } from "@loom/database";
import { Transform } from "class-transformer";
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from "class-validator";

/** Every Content API read names one language; the response carries that language only. */
export class DeliveryLocaleRequestDto {
  @IsString()
  @IsNotEmpty()
  locale: SiteLanguage["code"];

  /**
   * Serve the latest saved version of everything — drafts included — instead of what is published.
   * Only an API key allowed to read drafts may ask. A query string carries text, so `"false"` must
   * not become `true`, which a plain Boolean conversion would make it.
   */
  @IsOptional()
  @Transform(({ value }) => value === true || value === "true" || value === "1")
  @IsBoolean()
  preview?: boolean;
}
