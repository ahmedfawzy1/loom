import type { CategoryLocale } from "@loom/database";
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";
import {
  CATEGORY_DESCRIPTION_MAX_LENGTH,
  CATEGORY_SEO_DESCRIPTION_MAX_LENGTH,
  CATEGORY_SEO_DESCRIPTION_MIN_LENGTH,
  CATEGORY_SEO_TITLE_MAX_LENGTH,
  CATEGORY_TITLE_MAX_LENGTH,
} from "../../constants/validation.constants";

export class UpdateCategoryLocaleRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(CATEGORY_TITLE_MAX_LENGTH)
  title: CategoryLocale["title"];

  @IsString()
  @IsNotEmpty()
  @MaxLength(CATEGORY_DESCRIPTION_MAX_LENGTH)
  description: CategoryLocale["description"];

  // Blank is normalised to null on write — an empty string would collide with every other blank
  // one under @@unique([spaceId, languageCode, seoMetaTitle]), where NULLs stay distinct.
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== "")
  @IsString()
  @MaxLength(CATEGORY_SEO_TITLE_MAX_LENGTH)
  seoMetaTitle?: CategoryLocale["seoMetaTitle"];

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== "")
  @IsString()
  @MinLength(CATEGORY_SEO_DESCRIPTION_MIN_LENGTH)
  @MaxLength(CATEGORY_SEO_DESCRIPTION_MAX_LENGTH)
  seoMetaDescription?: CategoryLocale["seoMetaDescription"];
}
