import type { Blog, BlogLocale } from "@loom/database";
import { Expose, Type } from "class-transformer";
import { DeliveryAuthorResponseDto } from "./delivery-author-response.dto";
import { DeliveryCategoryResponseDto } from "./delivery-category-response.dto";
import { DeliveryMediaResponseDto } from "./delivery-media-response.dto";

export class DeliveryBlogSummaryResponseDto {
  @Expose()
  id: Blog["id"];

  @Expose()
  languageCode: BlogLocale["languageCode"];

  @Expose()
  slug: BlogLocale["slug"];

  @Expose()
  title: BlogLocale["title"];

  @Expose()
  description: BlogLocale["description"];

  @Expose()
  firstPublishedAt: NonNullable<BlogLocale["firstPublishedAt"]>;

  @Expose()
  publishedAt: NonNullable<BlogLocale["publishedAt"]>;

  @Expose()
  @Type(() => DeliveryMediaResponseDto)
  image: DeliveryMediaResponseDto | null;

  @Expose()
  @Type(() => DeliveryAuthorResponseDto)
  author: DeliveryAuthorResponseDto | null;

  @Expose()
  @Type(() => DeliveryCategoryResponseDto)
  category: DeliveryCategoryResponseDto | null;
}
