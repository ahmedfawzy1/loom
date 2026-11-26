import type { Blog } from "@loom/database";
import { Expose } from "class-transformer";
import { ContentItemResponseDto } from "./content-item-response.dto";

export class TrashItemResponseDto extends ContentItemResponseDto {
  @Expose()
  title: string;

  @Expose()
  deletedAt: NonNullable<Blog["deletedAt"]>;
}
