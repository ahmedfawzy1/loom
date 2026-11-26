import type { Blog, BlogLocale, BlogTag, Space } from "@loom/database";
import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import {
  BLOG_DESCRIPTION_MAX_LENGTH,
  BLOG_MAX_TAGS,
  BLOG_TITLE_MAX_LENGTH,
} from "../../constants/validation.constants";

/**
 * Creates the canonical Blog plus its default-language locale. The body and FAQ are set through the
 * locale endpoint once the editor exists — a new Blog starts with an empty document.
 */
export class CreateBlogRequestDto {
  @IsString()
  @IsNotEmpty()
  spaceId: Space["id"];

  @IsString()
  @IsNotEmpty()
  authorId: Blog["authorId"];

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  reviewerId?: NonNullable<Blog["reviewerId"]>;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  categoryId?: NonNullable<Blog["categoryId"]>;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  imageId?: NonNullable<Blog["imageId"]>;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(BLOG_MAX_TAGS)
  @IsString({ each: true })
  tagIds?: BlogTag["tagId"][];

  @IsString()
  @IsNotEmpty()
  @MaxLength(BLOG_TITLE_MAX_LENGTH)
  title: BlogLocale["title"];

  @IsString()
  @IsNotEmpty()
  @MaxLength(BLOG_DESCRIPTION_MAX_LENGTH)
  description: BlogLocale["description"];

  // Any script is allowed — a translated slug is written in the target language. Omitted means
  // derive it from the title.
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  slug?: BlogLocale["slug"];
}
