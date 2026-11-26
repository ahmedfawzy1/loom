import type { Site } from "@loom/database";
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from "class-validator";
import { SLUG_PATTERN } from "../../constants/validation.constants";

export class CreateSiteRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name: Site["name"];

  @IsString()
  @Matches(SLUG_PATTERN)
  @MaxLength(50)
  slug: Site["slug"];

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  domain: Site["domain"];

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  defaultLanguage?: Site["defaultLanguage"];
}
