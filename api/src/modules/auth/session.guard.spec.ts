import { CmsRole, CmsUserStatus } from "@loom/database";
import { SESSION_COOKIE_NAME } from "@loom/dto/constants";
import {
  type ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { describe, expect, it, vi } from "vitest";
import { SessionGuard } from "./session.guard";
import type { SessionService } from "./session.service";

const user = {
  id: "user-1",
  email: "ada@example.com",
  name: "Ada",
  role: CmsRole.AUTHOR,
  status: CmsUserStatus.ACTIVE,
};

function guardFor({
  isPublic = false,
  renewed = false,
}: {
  isPublic?: boolean;
  renewed?: boolean;
} = {}) {
  const reflector = { getAllAndOverride: vi.fn(() => isPublic) };
  const sessions = {
    authenticate: vi.fn(async () => ({ user, renewed })),
    setCookie: vi.fn(),
  };
  const guard = new SessionGuard(
    reflector as unknown as Reflector,
    sessions as unknown as SessionService,
  );
  return { guard, sessions };
}

function contextFor(overrides: Partial<Request> = {}) {
  const request = {
    method: "GET",
    path: "/admin/me",
    headers: {},
    ...overrides,
  } as Request;
  const response = {};
  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
  return { context, request, response };
}

const signedIn = { cookie: `${SESSION_COOKIE_NAME}=token-1` };

describe("SessionGuard", () => {
  it("signs a request in as its session's person", async () => {
    const { guard, sessions } = guardFor();
    const { context, request } = contextFor({ headers: signedIn });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(sessions.authenticate).toHaveBeenCalledWith("token-1");
    expect(request.cmsUser).toEqual(user);
    expect(request.sessionToken).toBe("token-1");
    expect(sessions.setCookie).not.toHaveBeenCalled();
  });

  it("sends the cookie again when the session's expiry moved", async () => {
    const { guard, sessions } = guardFor({ renewed: true });
    const { context, response } = contextFor({ headers: signedIn });
    await guard.canActivate(context);
    expect(sessions.setCookie).toHaveBeenCalledWith(response, "token-1");
  });

  it("refuses a request with no session cookie", async () => {
    const { guard, sessions } = guardFor();
    await expect(guard.canActivate(contextFor().context)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(sessions.authenticate).not.toHaveBeenCalled();
  });

  it("lets a public route answer for itself", async () => {
    const { guard, sessions } = guardFor({ isPublic: true });
    const { context } = contextFor({
      method: "POST",
      path: "/admin/auth/login",
    });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(sessions.authenticate).not.toHaveBeenCalled();
  });

  it.each([
    ["a signed-in change", false, "/admin/users"],
    ["a sign-in, which is public", true, "/admin/auth/login"],
  ])("refuses %s another site makes", async (_, isPublic, path) => {
    const { guard } = guardFor({ isPublic });
    const { context } = contextFor({
      method: "POST",
      path,
      headers: { ...signedIn, "sec-fetch-site": "cross-site" },
    });
    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("leaves /mcp to its own tokens, wherever the request comes from", async () => {
    const { guard } = guardFor({ isPublic: true });
    const { context } = contextFor({
      method: "POST",
      path: "/mcp",
      headers: { "sec-fetch-site": "cross-site" },
    });
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
