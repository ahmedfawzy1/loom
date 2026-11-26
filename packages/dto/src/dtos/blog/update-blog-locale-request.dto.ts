import type { BlogLocale } from "@loom/database";
import { Type } from "class-transformer";
import {
  IsArray,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import {
  BLOG_DESCRIPTION_MAX_LENGTH,
  BLOG_SUMMARY_MAX_LENGTH,
  BLOG_SUMMARY_MIN_LENGTH,
  BLOG_TITLE_MAX_LENGTH,
  BLOG_UPDATE_NOTE_MAX_LENGTH,
} from "../../constants/validation.constants";
import { FaqItemDto } from "./faq-item.dto";

export class UpdateBlogLocaleRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(BLOG_TITLE_MAX_LENGTH)
  title: BlogLocale["title"];

  @IsString()
  @IsNotEmpty()
  @MaxLength(BLOG_DESCRIPTION_MAX_LENGTH)
  description: BlogLocale["description"];

  @IsString()
  @IsNotEmpty()
  slug: BlogLocale["slug"];

  /**
   * Blank while the post is being written, then 120–600 once it says anything. Publishing is what
   * requires it — a draft that has not been written yet cannot have a summary of it.
   */
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== "")
  @IsString()
  @MinLength(BLOG_SUMMARY_MIN_LENGTH)
  @MaxLength(BLOG_SUMMARY_MAX_LENGTH)
  summary?: BlogLocale["summary"];

  @IsOptional()
  @IsString()
  @MaxLength(BLOG_UPDATE_NOTE_MAX_LENGTH)
  updateNote?: BlogLocale["updateNote"];

  // Tiptap document. Its inner shape is the editor's contract, checked when the body is saved.
  @IsOptional()
  @IsObject()
  body?: object;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FaqItemDto)
  faq?: FaqItemDto[];
}
