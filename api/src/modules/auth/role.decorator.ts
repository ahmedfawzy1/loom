import type { CmsRole } from "@loom/database";
import { SetMetadata } from "@nestjs/common";

export const ROLES_KEY = "roles";
export const Roles = (...roles: CmsRole[]) => SetMetadata(ROLES_KEY, roles);
