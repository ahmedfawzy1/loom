import type { CategoryLocale } from "@loom/database";
import { Expose } from "class-transformer";
import { LocaleStateResponseDto } from "../content/locale-state-response.dto";

export class CategoryLocaleResponseDto extends LocaleStateResponseDto {
  @Expose()
  title: CategoryLocale["title"];

  @Expose()
  description: CategoryLocale["description"];

  @Expose()
  seoMetaTitle: CategoryLocale["seoMetaTitle"];

  @Expose()
  seoMetaDescription: CategoryLocale["seoMetaDescription"];
}
