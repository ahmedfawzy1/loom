import type { CmsUser } from "@loom/database";

/** The person a request acts as, as every service sees them. */
export type AuthenticatedUser = Pick<
  CmsUser,
  "id" | "email" | "name" | "role" | "status"
>;

/** The columns that make an AuthenticatedUser, for a `select`. */
export const AUTHENTICATED_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  status: true,
} as const;
