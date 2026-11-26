import type { Category, CategoryLocale } from "@loom/database";
import { Expose, Type } from "class-transformer";
import { DeliveryMediaResponseDto } from "./delivery-media-response.dto";

export class DeliveryCategoryResponseDto {
  @Expose()
  id: Category["id"];

  /** The language this came from: the one asked for, or the default language when it is not live in it. */
  @Expose()
  languageCode: CategoryLocale["languageCode"];

  @Expose()
  slug: Category["slug"];

  @Expose()
  gameCode: Category["gameCode"];

  @Expose()
  title: CategoryLocale["title"];

  @Expose()
  description: CategoryLocale["description"];

  @Expose()
  seoMetaTitle: CategoryLocale["seoMetaTitle"];

  @Expose()
  seoMetaDescription: CategoryLocale["seoMetaDescription"];

  @Expose()
  @Type(() => DeliveryMediaResponseDto)
  featuredImage: DeliveryMediaResponseDto | null;

  @Expose()
  @Type(() => DeliveryMediaResponseDto)
  featureIcon: DeliveryMediaResponseDto | null;

  @Expose()
  @Type(() => DeliveryMediaResponseDto)
  gameCover: DeliveryMediaResponseDto | null;
}
