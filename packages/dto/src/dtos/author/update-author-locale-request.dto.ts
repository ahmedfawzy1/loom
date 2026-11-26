import type { AuthorLocale } from "@loom/database";
import { IsOptional, IsString, MaxLength } from "class-validator";
import {
  AUTHOR_BIO_MAX_LENGTH,
  AUTHOR_JOB_TITLE_MAX_LENGTH,
} from "../../constants/validation.constants";

export class UpdateAuthorLocaleRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(AUTHOR_JOB_TITLE_MAX_LENGTH)
  jobTitle?: AuthorLocale["jobTitle"];

  @IsOptional()
  @IsString()
  @MaxLength(AUTHOR_BIO_MAX_LENGTH)
  bio?: AuthorLocale["bio"];
}
