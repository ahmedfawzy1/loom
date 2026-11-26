import type { Space, Tag, TagLocale } from "@loom/database";
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from "class-validator";
import {
  SLUG_MAX_LENGTH,
  SLUG_PATTERN,
  TAG_DESCRIPTION_MAX_LENGTH,
  TAG_TITLE_MAX_LENGTH,
} from "../../constants/validation.constants";

export class CreateTagRequestDto {
  @IsString()
  @IsNotEmpty()
  spaceId: Space["id"];

  @IsString()
  @Matches(SLUG_PATTERN)
  @MaxLength(SLUG_MAX_LENGTH)
  slug: Tag["slug"];

  // The hash is chrome, not part of the name
  @IsString()
  @IsNotEmpty()
  @MaxLength(TAG_TITLE_MAX_LENGTH)
  @Matches(/^[^#]/, { message: "title must not start with #" })
  title: TagLocale["title"];

  @IsString()
  @IsNotEmpty()
  @MaxLength(TAG_DESCRIPTION_MAX_LENGTH)
  description: TagLocale["description"];

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  featuredImageId?: NonNullable<Tag["featuredImageId"]>;
}
