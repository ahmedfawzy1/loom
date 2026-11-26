import type { BlogLocale } from "@loom/database";
import { Expose } from "class-transformer";
import { LocaleStateResponseDto } from "../content/locale-state-response.dto";

export class BlogLocaleResponseDto extends LocaleStateResponseDto {
  @Expose()
  title: BlogLocale["title"];

  @Expose()
  description: BlogLocale["description"];

  @Expose()
  slug: BlogLocale["slug"];

  @Expose()
  summary: BlogLocale["summary"];

  @Expose()
  updateNote: BlogLocale["updateNote"];

  @Expose()
  body: BlogLocale["body"];

  @Expose()
  faq: BlogLocale["faq"];
}
