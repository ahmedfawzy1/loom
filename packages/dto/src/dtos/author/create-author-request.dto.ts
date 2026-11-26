import type { Author, AuthorLocale, Space } from "@loom/database";
import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from "class-validator";
import {
  AUTHOR_BIO_MAX_LENGTH,
  AUTHOR_JOB_TITLE_MAX_LENGTH,
  AUTHOR_MAX_SOCIAL_LINKS,
  AUTHOR_NAME_MAX_LENGTH,
} from "../../constants/validation.constants";

export class CreateAuthorRequestDto {
  @IsString()
  @IsNotEmpty()
  spaceId: Space["id"];

  // Canonical, not per locale — a byline identity should not drift between languages
  @IsString()
  @IsNotEmpty()
  @MaxLength(AUTHOR_NAME_MAX_LENGTH)
  name: Author["name"];

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  profileImageId?: NonNullable<Author["profileImageId"]>;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(AUTHOR_MAX_SOCIAL_LINKS)
  @IsUrl({}, { each: true })
  socialLinks?: Author["socialLinks"];

  @IsOptional()
  @IsString()
  @MaxLength(AUTHOR_JOB_TITLE_MAX_LENGTH)
  jobTitle?: AuthorLocale["jobTitle"];

  @IsOptional()
  @IsString()
  @MaxLength(AUTHOR_BIO_MAX_LENGTH)
  bio?: AuthorLocale["bio"];
}
