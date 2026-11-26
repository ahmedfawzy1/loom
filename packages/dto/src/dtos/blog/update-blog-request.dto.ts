import type { Blog, BlogTag } from "@loom/database";
import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
} from "class-validator";
import { BLOG_MAX_TAGS } from "../../constants/validation.constants";

/** Canonical fields. These are shared by every locale, so editing them is a default-language act. */
export class UpdateBlogRequestDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  authorId?: Blog["authorId"];

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @IsNotEmpty()
  reviewerId?: Blog["reviewerId"];

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @IsNotEmpty()
  categoryId?: Blog["categoryId"];

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @IsNotEmpty()
  imageId?: Blog["imageId"];

  // Ordered: position is the array index
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(BLOG_MAX_TAGS)
  @IsString({ each: true })
  tagIds?: BlogTag["tagId"][];
}
