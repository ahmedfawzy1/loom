import type { CtaLocale } from "@loom/database";
import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";
import {
  CTA_BUTTON_LABEL_MAX_LENGTH,
  CTA_DESCRIPTION_MAX_LENGTH,
  CTA_TITLE_MAX_LENGTH,
} from "../../constants/validation.constants";

export class UpdateCtaLocaleRequestDto {
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
