import type { CmsPasswordLink } from "@loom/database";
import { Expose } from "class-transformer";

/**
 * A link an Admin sends someone so they can choose a password. Shown once: only a hash of the token
 * is stored, so a lost link is replaced, never recovered.
 */
export class PasswordLinkResponseDto {
  /** Goes in the admin app's SET_PASSWORD_PATH as `#token=…`. */
  @Expose()
  token: string;

  @Expose()
  expiresAt: CmsPasswordLink["expiresAt"];
}
