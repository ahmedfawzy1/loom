import { SESSION_COOKIE_NAME } from "@loom/dto/constants";
import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request, Response } from "express";
import {
  isAdminRequest,
  isCrossSiteWrite,
  readCookie,
} from "./auth-request.util";
import { IS_PUBLIC_KEY } from "./public.decorator";
import { SessionService } from "./session.service";

/**
 * Who a request acts as: the person whose session cookie it carries. Routes marked @Public answer
 * for themselves — signing in, the Content API with its keys, /mcp with its tokens.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();

    // Ahead of the public check, because signing in is public and another site must not do that
    // in someone's browser either
    if (isAdminRequest(request) && isCrossSiteWrite(request))
      throw new ForbiddenException("Changes can only be made from Loom itself");

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const token = readCookie(request.headers.cookie, SESSION_COOKIE_NAME);
    if (!token) throw new UnauthorizedException("Sign in to continue");

    const { user, renewed } = await this.sessions.authenticate(token);
    request.cmsUser = user;
    request.sessionToken = token;
    // The expiry moved, so the browser's copy of the cookie has to move with it
    if (renewed) this.sessions.setCookie(http.getResponse<Response>(), token);
    return true;
  }
}
