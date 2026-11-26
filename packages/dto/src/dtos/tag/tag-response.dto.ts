import type { Tag } from "@loom/database";
import { Expose, Type } from "class-transformer";
import { TagLocaleResponseDto } from "./tag-locale-response.dto";

export class TagResponseDto {
  @Expose()
  id: Tag["id"];

  @Expose()
  spaceId: Tag["spaceId"];

  @Expose()
  slug: Tag["slug"];

  @Expose()
  featuredImageId: Tag["featuredImageId"];

  @Expose()
  createdAt: Tag["createdAt"];

  @Expose()
  updatedAt: Tag["updatedAt"];

  @Expose()
  deletedAt: Tag["deletedAt"];

  @Expose()
  @Type(() => TagLocaleResponseDto)
  locales: TagLocaleResponseDto[];
}
