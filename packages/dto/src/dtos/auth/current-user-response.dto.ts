import type { CmsUser } from "@loom/database";
import { Expose } from "class-transformer";

export class CurrentUserResponseDto
  implements Pick<CmsUser, "id" | "email" | "name" | "role" | "status">
{
  @Expose()
  id: CmsUser["id"];

  @Expose()
  email: CmsUser["email"];

  @Expose()
  name: CmsUser["name"];

  @Expose()
  role: CmsUser["role"];

  @Expose()
  status: CmsUser["status"];
}
