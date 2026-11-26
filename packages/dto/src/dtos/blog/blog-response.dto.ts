import type { Blog, BlogTag } from "@loom/database";
import { Expose, Type } from "class-transformer";
import { BlogLocaleResponseDto } from "./blog-locale-response.dto";

export class BlogResponseDto {
  @Expose()
  id: Blog["id"];

  @Expose()
  spaceId: Blog["spaceId"];

  @Expose()
  authorId: Blog["authorId"];

  @Expose()
  reviewerId: Blog["reviewerId"];

  @Expose()
  categoryId: Blog["categoryId"];

  @Expose()
  imageId: Blog["imageId"];

  @Expose()
  createdAt: Blog["createdAt"];

  @Expose()
  updatedAt: Blog["updatedAt"];

  @Expose()
  deletedAt: Blog["deletedAt"];

  /** Tag ids in their stored order — position is the array index. */
  @Expose()
  tagIds: BlogTag["tagId"][];

  @Expose()
  @Type(() => BlogLocaleResponseDto)
  locales: BlogLocaleResponseDto[];
}
