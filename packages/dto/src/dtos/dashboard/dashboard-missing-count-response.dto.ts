import type { CmsContentType } from "@loom/database";
import { Expose } from "class-transformer";

/** How many items of a type have no version in the language worked in. */
export class DashboardMissingCountResponseDto {
  @Expose()
  type: CmsContentType;

  @Expose()
  count: number;
}
