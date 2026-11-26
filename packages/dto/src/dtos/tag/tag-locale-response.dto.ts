import type { TagLocale } from "@loom/database";
import { Expose } from "class-transformer";
import { LocaleStateResponseDto } from "../content/locale-state-response.dto";

export class TagLocaleResponseDto extends LocaleStateResponseDto {
  @Expose()
  title: TagLocale["title"];

  @Expose()
  description: TagLocale["description"];
}
