import type { Blog, CmsContentType } from "@loom/database";
import { Expose } from "class-transformer";

/** Points at one content item of any type — what Duplicate returns so the editor can open the copy. */
export class ContentItemResponseDto {
  @Expose()
  type: CmsContentType;

  @Expose()
  id: Blog["id"];
}
