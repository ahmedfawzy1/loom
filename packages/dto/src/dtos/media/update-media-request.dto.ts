import type { Media } from "@loom/database";
import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";
import {
  MEDIA_ALT_TEXT_MAX_LENGTH,
  MEDIA_FILENAME_MAX_LENGTH,
} from "../../constants/validation.constants";

export class UpdateMediaRequestDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MEDIA_FILENAME_MAX_LENGTH)
  filename?: Media["filename"];

  @IsOptional()
  @IsString()
  @MaxLength(MEDIA_ALT_TEXT_MAX_LENGTH)
  altText?: Media["altText"];
}
