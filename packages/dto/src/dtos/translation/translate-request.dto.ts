import type { SiteLanguage } from "@loom/database";
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
} from "class-validator";

/**
 * Which languages to translate an item into: the listed ones; with `missing`, every
 * enabled language the item has no content in yet; with `stale`, every one whose source has
 * changed since it was translated.
 */
export class TranslateRequestDto {
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  languages?: SiteLanguage["code"][];

  @IsOptional()
  @IsBoolean()
  missing?: boolean;

  @IsOptional()
  @IsBoolean()
  stale?: boolean;

  /**
   * Fields to translate again even where a person edited them — by default a changed field someone
   * edited is kept, and only the ones still as the machine wrote them are updated.
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fields?: string[];

  /** Translate every field again, not only those whose source text changed since the last run. */
  @IsOptional()
  @IsBoolean()
  retranslate?: boolean;
}
