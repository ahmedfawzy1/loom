import type { CmsUser } from "@loom/database";
import { Expose } from "class-transformer";

/** Who did something — the person behind a version or a submission. */
export class ContentUserResponseDto {
  @Expose()
  id: CmsUser["id"];

  @Expose()
  email: CmsUser["email"];

  @Expose()
  name: CmsUser["name"];
}
