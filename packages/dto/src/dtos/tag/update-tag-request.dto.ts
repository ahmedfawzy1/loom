import type { Tag } from "@loom/database";
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from "class-validator";
import {
  SLUG_MAX_LENGTH,
  SLUG_PATTERN,
} from "../../constants/validation.constants";

export class UpdateTagRequestDto {
  @IsOptional()
  @IsString()
  @Matches(SLUG_PATTERN)
  @MaxLength(SLUG_MAX_LENGTH)
  slug?: Tag["slug"];

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @IsNotEmpty()
  featuredImageId?: Tag["featuredImageId"];
}
