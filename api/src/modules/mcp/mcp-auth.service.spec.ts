import { CmsRole, CmsUserStatus } from "@loom/database";
import { UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "../auth/auth.types";
import type { McpTokenService } from "../mcp-token/mcp-token.service";
import { McpAuthService } from "./mcp-auth.service";

const admin: AuthenticatedUser = {
  id: "user-1",
  email: "admin@example.com",
  name: "Admin",
  role: CmsRole.ADMIN,
  status: CmsUserStatus.ACTIVE,
};

function authService() {
  const tokens = { authenticate: vi.fn(async () => admin) };
  const service = new McpAuthService(tokens as unknown as McpTokenService);
  return { service, tokens };
}

const request = (authorization?: string) =>
  ({ headers: authorization ? { authorization } : {} }) as Request;

describe("McpAuthService", () => {
  it("authenticates a bearer token", async () => {
    const { service, tokens } = authService();
    await expect(
      service.authenticate(request("Bearer loom_mcp_abc")),
    ).resolves.toBe(admin);
    expect(tokens.authenticate).toHaveBeenCalledWith("loom_mcp_abc");
  });

  it("accepts the scheme in any case", async () => {
    const { service } = authService();
    await expect(
      service.authenticate(request("bearer loom_mcp_abc")),
    ).resolves.toBe(admin);
  });

  it.each([
    ["another scheme", "Basic abc"],
    ["a scheme with no token", "Bearer"],
  ])("refuses %s", async (_, header) => {
    const { service, tokens } = authService();
    await expect(service.authenticate(request(header))).rejects.toThrow(
      UnauthorizedException,
    );
    expect(tokens.authenticate).not.toHaveBeenCalled();
  });

  it("requires a token: there is no tokenless sign-in, locally or anywhere", async () => {
    const { service, tokens } = authService();
    await expect(service.authenticate(request())).rejects.toThrow(
      "Make one in Loom, under Settings → MCP",
    );
    expect(tokens.authenticate).not.toHaveBeenCalled();
  });
});
