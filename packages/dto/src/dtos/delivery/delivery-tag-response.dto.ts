import type { Tag, TagLocale } from "@loom/database";
import { Expose, Type } from "class-transformer";
import { DeliveryMediaResponseDto } from "./delivery-media-response.dto";

export class DeliveryTagResponseDto {
  @Expose()
  id: Tag["id"];

  /** The language this came from: the one asked for, or the default language when it is not live in it. */
  @Expose()
  languageCode: TagLocale["languageCode"];

  @Expose()
  slug: Tag["slug"];

  @Expose()
  title: TagLocale["title"];

  @Expose()
  description: TagLocale["description"];

  @Expose()
  @Type(() => DeliveryMediaResponseDto)
  featuredImage: DeliveryMediaResponseDto | null;
}
