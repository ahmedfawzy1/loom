import type { AuthorLocale } from "@loom/database";
import { Expose } from "class-transformer";
import { LocaleStateResponseDto } from "../content/locale-state-response.dto";

export class AuthorLocaleResponseDto extends LocaleStateResponseDto {
  @Expose()
  jobTitle: AuthorLocale["jobTitle"];

  @Expose()
  bio: AuthorLocale["bio"];
}
