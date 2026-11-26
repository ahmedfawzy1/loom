import type { CtaLocale } from "@loom/database";
import { Expose } from "class-transformer";
import { LocaleStateResponseDto } from "../content/locale-state-response.dto";

export class CtaLocaleResponseDto extends LocaleStateResponseDto {
  @Expose()
  title: CtaLocale["title"];

  @Expose()
  description: CtaLocale["description"];

  @Expose()
  buttonLabel: CtaLocale["buttonLabel"];
}
