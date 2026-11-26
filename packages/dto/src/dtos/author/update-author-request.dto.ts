import type { Author } from "@loom/database";
import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateIf,
} from "class-validator";
import {
  AUTHOR_MAX_SOCIAL_LINKS,
  AUTHOR_NAME_MAX_LENGTH,
} from "../../constants/validation.constants";

export class UpdateAuthorRequestDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(AUTHOR_NAME_MAX_LENGTH)
  name?: Author["name"];

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @IsNotEmpty()
  profileImageId?: Author["profileImageId"];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(AUTHOR_MAX_SOCIAL_LINKS)
  @IsUrl({}, { each: true })
  socialLinks?: Author["socialLinks"];
}
