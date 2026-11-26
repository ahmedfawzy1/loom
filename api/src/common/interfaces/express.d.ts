import type { ApiKey } from "@loom/database";
import type { AuthenticatedUser } from "../../modules/auth/auth.types";

declare global {
  namespace Express {
    interface Request {
      cmsUser?: AuthenticatedUser;
      /** Set by SessionGuard: this request's session, which a password change keeps signed in. */
      sessionToken?: string;
      /** Set by ApiKeyGuard on Content API requests. */
      apiKey?: ApiKey;
    }
  }
}
