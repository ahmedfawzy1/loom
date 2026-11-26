import type { Cta, CtaLocale, Space } from "@loom/database";
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from "class-validator";
import {
  CMPID_PATTERN,
  CTA_BUTTON_LABEL_MAX_LENGTH,
  CTA_CMPID_MAX_LENGTH,
  CTA_DESCRIPTION_MAX_LENGTH,
  CTA_TITLE_MAX_LENGTH,
  CTA_URL_PATTERN,
} from "../../constants/validation.constants";

export class CreateCtaRequestDto {
  @IsString()
  @IsNotEmpty()
  spaceId: Space["id"];

  @IsString()
  @Matches(CTA_URL_PATTERN, {
    message: "url must be an https URL or a relative /path",
  })
  url: Cta["url"];

  // Not unique: one campaign legitimately runs two creatives under one id.
  // Blank is accepted and stored as null, matching the update path — an empty form field must not
  // mean one thing on create and another on edit.
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== "")
  @IsString()
  @Matches(CMPID_PATTERN)
  @MaxLength(CTA_CMPID_MAX_LENGTH)
  cmpid?: Cta["cmpid"];

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  imageId?: NonNullable<Cta["imageId"]>;

  @IsString()
  @IsNotEmpty()
  @MaxLength(CTA_TITLE_MAX_LENGTH)
  title: CtaLocale["title"];

  @IsOptional()
  @IsString()
  @MaxLength(CTA_DESCRIPTION_MAX_LENGTH)
  description?: CtaLocale["description"];

  @IsString()
  @IsNotEmpty()
  @MaxLength(CTA_BUTTON_LABEL_MAX_LENGTH)
  buttonLabel: CtaLocale["buttonLabel"];
}
