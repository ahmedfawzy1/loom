import type { Cta } from "@loom/database";
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
  CTA_CMPID_MAX_LENGTH,
  CTA_URL_PATTERN,
} from "../../constants/validation.constants";

export class UpdateCtaRequestDto {
  @IsOptional()
  @IsString()
  @Matches(CTA_URL_PATTERN, {
    message: "url must be an https URL or a relative /path",
  })
  url?: Cta["url"];

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== "")
  @IsString()
  @Matches(CMPID_PATTERN)
  @MaxLength(CTA_CMPID_MAX_LENGTH)
  cmpid?: Cta["cmpid"];

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @IsNotEmpty()
  imageId?: Cta["imageId"];
}
