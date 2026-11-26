import type { SiteLanguage } from "@loom/database";
import { Expose, Type } from "class-transformer";
import { TranslationFieldStateResponseDto } from "./translation-field-state-response.dto";

/** A language of an item, and which of its fields are behind the source. */
export class TranslationFieldsResponseDto {
  @Expose()
  languageCode: SiteLanguage["code"];

  @Expose()
  @Type(() => TranslationFieldStateResponseDto)
  fields: TranslationFieldStateResponseDto[];
}
