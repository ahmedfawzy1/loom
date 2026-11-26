import {
  type Blog,
  type BlogLocale,
  type BlogTag,
  LocaleStatus,
  type Space,
} from "@loom/database";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";
import {
  LIST_DEFAULT_PAGE_SIZE,
  LIST_MAX_PAGE_SIZE,
} from "../../constants/validation.constants";

export const LIST_SORT_FIELDS = ["updatedAt", "createdAt", "title"] as const;
export type ListSortField = (typeof LIST_SORT_FIELDS)[number];

export class ListContentRequestDto {
  @IsString()
  @IsNotEmpty()
  spaceId: Space["id"];

  /** Which locale's text the list shows and searches. */
  @IsString()
  @IsNotEmpty()
  language: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsEnum(LocaleStatus)
  status?: LocaleStatus;

  /** Who submitted the language shown for review. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  submittedById?: NonNullable<BlogLocale["submittedById"]>;

  /** Edited in any language on or after this moment. */
  @IsOptional()
  @IsDateString()
  updatedFrom?: string;

  /** Edited in any language before this moment. */
  @IsOptional()
  @IsDateString()
  updatedTo?: string;

  // Posts only: a post's category, byline and tags
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  categoryId?: NonNullable<Blog["categoryId"]>;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  authorId?: Blog["authorId"];

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  tagId?: BlogTag["tagId"];

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

  @IsOptional()
  @IsIn(LIST_SORT_FIELDS)
  sort?: ListSortField;

  @IsOptional()
  @IsIn(["asc", "desc"])
  direction?: "asc" | "desc";
}

export const listDefaults = {
  page: 1,
  pageSize: LIST_DEFAULT_PAGE_SIZE,
  sort: "updatedAt" as ListSortField,
  direction: "desc" as const,
};
