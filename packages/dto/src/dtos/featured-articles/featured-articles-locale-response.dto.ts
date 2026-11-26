import type { Blog } from "@loom/database";
import { Expose } from "class-transformer";
import { LocaleStateResponseDto } from "../content/locale-state-response.dto";

export class FeaturedArticlesLocaleResponseDto extends LocaleStateResponseDto {
  /** Blog ids in carousel order. */
  @Expose()
  blogIds: Blog["id"][];
}
