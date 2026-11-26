import type { CmsPasswordLink, CmsUser } from "@loom/database";
import { Expose } from "class-transformer";

export class CmsUserResponseDto
  implements
    Pick<
      CmsUser,
      "id" | "email" | "name" | "role" | "status" | "createdAt" | "lastActiveAt"
    >
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

  /** When an Admin added them. */
  @Expose()
  createdAt: CmsUser["createdAt"];

  /** Null until they first sign in. */
  @Expose()
  lastActiveAt: CmsUser["lastActiveAt"];

  /** When their unused password link stops working; null when they have none. */
  @Expose()
  passwordLinkExpiresAt: CmsPasswordLink["expiresAt"] | null;
}
