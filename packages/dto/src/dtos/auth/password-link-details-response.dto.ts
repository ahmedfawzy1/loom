import type { CmsPasswordLink, CmsUser } from "@loom/database";
import { Expose } from "class-transformer";

/** What the set-password page shows before anyone types: whose account, and why they are here. */
export class PasswordLinkDetailsResponseDto {
  @Expose()
  email: CmsUser["email"];

  @Expose()
  name: CmsUser["name"];

  /** An invite: the person has never had a password. Otherwise the link replaces one. */
  @Expose()
  isInvite: boolean;

  @Expose()
  expiresAt: CmsPasswordLink["expiresAt"];
}
