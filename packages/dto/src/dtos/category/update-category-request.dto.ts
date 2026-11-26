import type { Category } from "@loom/database";
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from "class-validator";
import {
  GAME_CODE_MAX_LENGTH,
  GAME_CODE_PATTERN,
  SLUG_MAX_LENGTH,
  SLUG_PATTERN,
} from "../../constants/validation.constants";

/** Canonical fields only — the per-locale text goes through the locale endpoint. */
export class UpdateCategoryRequestDto {
  @IsOptional()
  @IsString()
  @Matches(SLUG_PATTERN)
  @MaxLength(SLUG_MAX_LENGTH)
  slug?: Category["slug"];

  @IsOptional()
  @IsString()
  @Matches(GAME_CODE_PATTERN)
  @MaxLength(GAME_CODE_MAX_LENGTH)
  gameCode?: Category["gameCode"];

  // null clears the image; undefined leaves it alone
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @IsNotEmpty()
  featuredImageId?: Category["featuredImageId"];

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @IsNotEmpty()
  featureIconId?: Category["featureIconId"];

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @IsNotEmpty()
  gameCoverId?: Category["gameCoverId"];
}
