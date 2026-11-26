import type { Category, CategoryLocale, Space } from "@loom/database";
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from "class-validator";
import {
  CATEGORY_DESCRIPTION_MAX_LENGTH,
  CATEGORY_TITLE_MAX_LENGTH,
  GAME_CODE_MAX_LENGTH,
  GAME_CODE_PATTERN,
  SLUG_MAX_LENGTH,
  SLUG_PATTERN,
} from "../../constants/validation.constants";

/** Creates the canonical Category plus its default-language locale in one call. */
export class CreateCategoryRequestDto {
  @IsString()
  @IsNotEmpty()
  spaceId: Space["id"];

  @IsString()
  @Matches(SLUG_PATTERN)
  @MaxLength(SLUG_MAX_LENGTH)
  slug: Category["slug"];

  @IsString()
  @Matches(GAME_CODE_PATTERN)
  @MaxLength(GAME_CODE_MAX_LENGTH)
  gameCode: Category["gameCode"];

  @IsString()
  @IsNotEmpty()
  @MaxLength(CATEGORY_TITLE_MAX_LENGTH)
  title: CategoryLocale["title"];

  @IsString()
  @IsNotEmpty()
  @MaxLength(CATEGORY_DESCRIPTION_MAX_LENGTH)
  description: CategoryLocale["description"];

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  featuredImageId?: NonNullable<Category["featuredImageId"]>;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  featureIconId?: NonNullable<Category["featureIconId"]>;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  gameCoverId?: NonNullable<Category["gameCoverId"]>;
}
