import type { TagLocale } from "@loom/database";
import { IsNotEmpty, IsString, Matches, MaxLength } from "class-validator";
import {
  TAG_DESCRIPTION_MAX_LENGTH,
  TAG_TITLE_MAX_LENGTH,
} from "../../constants/validation.constants";

export class UpdateTagLocaleRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(TAG_TITLE_MAX_LENGTH)
  @Matches(/^[^#]/, { message: "title must not start with #" })
  title: TagLocale["title"];

  @IsString()
  @IsNotEmpty()
  @MaxLength(TAG_DESCRIPTION_MAX_LENGTH)
  description: TagLocale["description"];
}
