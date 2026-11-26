import type { SiteLanguage, Space } from "@loom/database";
import { IsNotEmpty, IsString, MaxLength, MinLength } from "class-validator";
import {
  SEARCH_QUERY_MAX_LENGTH,
  SEARCH_QUERY_MIN_LENGTH,
} from "../../constants/validation.constants";

export class SearchRequestDto {
  @IsString()
  @IsNotEmpty()
  spaceId: Space["id"];

  /** The language worked in: a match in it is preferred, and its title shown. */
  @IsString()
  @IsNotEmpty()
  language: SiteLanguage["code"];

  @IsString()
  @MinLength(SEARCH_QUERY_MIN_LENGTH)
  @MaxLength(SEARCH_QUERY_MAX_LENGTH)
  q: string;
}
