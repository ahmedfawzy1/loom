import type { SiteLanguage } from "@loom/database";
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";
import {
  BULK_ACTIONS,
  type BulkAction,
} from "../../constants/content.constants";
import { BULK_MAX_ITEMS } from "../../constants/validation.constants";

export class BulkRequestDto {
  @IsIn(BULK_ACTIONS)
  action: BulkAction;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(BULK_MAX_ITEMS)
  @ArrayUnique()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  ids: string[];

  /** The languages a per-language action applies to. Trash and restore act on the whole item. */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  languages?: SiteLanguage["code"][];
}
