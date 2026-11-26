import type { Category } from "@loom/database";
import { Expose, Type } from "class-transformer";
import { CategoryLocaleResponseDto } from "./category-locale-response.dto";

export class CategoryResponseDto {
  @Expose()
  id: Category["id"];

  @Expose()
  spaceId: Category["spaceId"];

  @Expose()
  slug: Category["slug"];

  @Expose()
  gameCode: Category["gameCode"];

  @Expose()
  featuredImageId: Category["featuredImageId"];

  @Expose()
  featureIconId: Category["featureIconId"];

  @Expose()
  gameCoverId: Category["gameCoverId"];

  @Expose()
  createdAt: Category["createdAt"];

  @Expose()
  updatedAt: Category["updatedAt"];

  @Expose()
  deletedAt: Category["deletedAt"];

  @Expose()
  @Type(() => CategoryLocaleResponseDto)
  locales: CategoryLocaleResponseDto[];
}
