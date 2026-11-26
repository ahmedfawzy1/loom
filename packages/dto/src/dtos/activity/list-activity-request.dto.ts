import {
  AuditAction,
  CmsContentType,
  type CmsUser,
  type SiteLanguage,
  type Space,
} from "@loom/database";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";
import { LIST_MAX_PAGE_SIZE } from "../../constants/validation.constants";

export class ListActivityRequestDto {
  /** Only this Space's activity. Absent: everything, Site and user changes included. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  spaceId?: Space["id"];

  /** The language item titles are shown in, falling back to the default language. */
  @IsString()
  @IsNotEmpty()
  language: SiteLanguage["code"];

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  userId?: CmsUser["id"];

  @IsOptional()
  @IsEnum(AuditAction)
  action?: AuditAction;

  @IsOptional()
  @IsEnum(CmsContentType)
  contentType?: CmsContentType;

  /** One item's history. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  contentId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(LIST_MAX_PAGE_SIZE)
  pageSize?: number;
}
