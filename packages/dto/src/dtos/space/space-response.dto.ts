import type { Space } from "@loom/database";
import { Expose } from "class-transformer";

export class SpaceResponseDto
  implements Pick<Space, "id" | "siteId" | "name" | "slug" | "createdAt">
{
  @Expose()
  id: Space["id"];

  @Expose()
  siteId: Space["siteId"];

  @Expose()
  name: Space["name"];

  @Expose()
  slug: Space["slug"];

  @Expose()
  createdAt: Space["createdAt"];
}
