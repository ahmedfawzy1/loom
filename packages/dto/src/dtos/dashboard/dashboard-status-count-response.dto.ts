import type { BlogLocale, CmsContentType } from "@loom/database";
import { Expose } from "class-transformer";

export class DashboardStatusCountResponseDto {
  @Expose()
  type: CmsContentType;

  @Expose()
  status: BlogLocale["status"];

  @Expose()
  count: number;
}
