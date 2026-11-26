import type { CmsRole } from "@loom/database";
import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { ROLES_KEY } from "./role.decorator";

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<CmsRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Routes with no @Roles are open to anyone signed in. Everyone who can sign in has a role and
    // an active account — SessionGuard lets no one else through.
    if (!requiredRoles) return true;

    const { cmsUser } = context.switchToHttp().getRequest<Request>();
    if (!cmsUser || !requiredRoles.includes(cmsUser.role))
      throw new ForbiddenException(
        `This action requires one of: ${requiredRoles.join(", ")}`,
      );

    return true;
  }
}
