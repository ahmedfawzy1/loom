import type { FeaturedArticles } from "@loom/database";
import { Expose, Type } from "class-transformer";
import { FeaturedArticlesLocaleResponseDto } from "./featured-articles-locale-response.dto";

export class FeaturedArticlesResponseDto {
  @Expose()
  id: FeaturedArticles["id"];

  @Expose()
  spaceId: FeaturedArticles["spaceId"];

  @Expose()
  @Type(() => FeaturedArticlesLocaleResponseDto)
  locales: FeaturedArticlesLocaleResponseDto[];
}
