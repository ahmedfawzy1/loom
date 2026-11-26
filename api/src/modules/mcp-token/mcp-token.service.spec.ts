import { CmsRole, CmsUserStatus } from "@loom/database";
import { MCP_TOKEN_TTL_DAYS } from "@loom/dto/constants";
import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { AuditService } from "../audit/audit.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import type { PrismaService } from "../prisma/prisma.service";
import {
  DAY_MS,
  MCP_TOKEN_PREFIX,
  MCP_TOKEN_TOUCH_INTERVAL_MS,
  MCP_TOKEN_VISIBLE_LENGTH,
} from "./mcp-token.constants";
import { McpTokenService } from "./mcp-token.service";
import {
  generateMcpToken,
  hashMcpToken,
  mcpTokenExpiry,
} from "./mcp-token.util";

const TOKEN = `${MCP_TOKEN_PREFIX}known`;
const owner = {
  id: "user-1",
  email: "writer@example.com",
  name: "Wren",
  role: CmsRole.WRITER,
  status: CmsUserStatus.ACTIVE,
  lastActiveAt: new Date(),
};

const tokenRow = (overrides: object = {}) => ({
  id: "token-1",
  userId: owner.id,
  name: "Claude",
  tokenHash: hashMcpToken(TOKEN),
  tokenPrefix: TOKEN.slice(0, MCP_TOKEN_VISIBLE_LENGTH),
  lastUsedAt: new Date(),
  expiresAt: new Date(Date.now() + DAY_MS),
  revokedAt: null as Date | null,
  createdAt: new Date(),
  user: { ...owner },
  ...overrides,
});

function serviceWith(found: ReturnType<typeof tokenRow> | null) {
  const prisma = {
    mcpToken: {
      findUnique: vi.fn(async () => found),
      updateMany: vi.fn(async () => ({ count: 1 })),
      update: vi.fn(async ({ data }: { data: object }) => ({
        ...found,
        ...data,
      })),
      create: vi.fn(async ({ data }: { data: object }) => ({
        ...tokenRow(),
        ...data,
      })),
    },
    cmsUser: { update: vi.fn(async () => owner) },
  };
  const audit = { log: vi.fn() };
  const service = new McpTokenService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
  );
  return { service, prisma, audit };
}

describe("generateMcpToken", () => {
  it("makes a prefixed token and keeps only its hash and a visible prefix", () => {
    const { token, tokenHash, tokenPrefix } = generateMcpToken();
    expect(token.startsWith(MCP_TOKEN_PREFIX)).toBe(true);
    expect(token.length).toBeGreaterThan(MCP_TOKEN_PREFIX.length + 40);
    expect(tokenHash).toBe(hashMcpToken(token));
    expect(tokenHash).not.toContain(token);
    expect(tokenPrefix).toBe(token.slice(0, MCP_TOKEN_VISIBLE_LENGTH));
    expect(generateMcpToken().token).not.toBe(token);
  });

  it("runs out after the TTL", () => {
    const createdAt = new Date("2026-01-01T00:00:00Z");
    expect(mcpTokenExpiry(createdAt).getTime() - createdAt.getTime()).toBe(
      MCP_TOKEN_TTL_DAYS * DAY_MS,
    );
  });
});

describe("McpTokenService.authenticate", () => {
  it("acts as the token's owner", async () => {
    const { service } = serviceWith(tokenRow());
    await expect(service.authenticate(TOKEN)).resolves.toEqual({
      id: owner.id,
      email: owner.email,
      name: owner.name,
      role: owner.role,
      status: owner.status,
    });
  });

  it("does not look up anything that is not an MCP token", async () => {
    const { service, prisma } = serviceWith(tokenRow());
    await expect(service.authenticate("loom_content_key")).rejects.toThrow(
      UnauthorizedException,
    );
    expect(prisma.mcpToken.findUnique).not.toHaveBeenCalled();
  });

  it.each([
    ["an unknown token", null],
    ["a revoked token", tokenRow({ revokedAt: new Date() })],
    ["an expired token", tokenRow({ expiresAt: new Date(Date.now() - 1) })],
  ])("refuses %s with the same 401", async (_, found) => {
    const { service } = serviceWith(found);
    await expect(service.authenticate(TOKEN)).rejects.toThrow(
      "That MCP token is not valid, or has expired or been revoked",
    );
  });

  it.each([
    ["a disabled account", { status: CmsUserStatus.DISABLED }],
    [
      "an account that never chose a password",
      { status: CmsUserStatus.PENDING },
    ],
  ])("refuses %s", async (_, user) => {
    const { service } = serviceWith(tokenRow({ user: { ...owner, ...user } }));
    await expect(service.authenticate(TOKEN)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("records use at most once a minute", async () => {
    const recent = serviceWith(tokenRow({ lastUsedAt: new Date() }));
    await recent.service.authenticate(TOKEN);
    expect(recent.prisma.mcpToken.updateMany).not.toHaveBeenCalled();

    const stale = serviceWith(
      tokenRow({
        lastUsedAt: new Date(Date.now() - MCP_TOKEN_TOUCH_INTERVAL_MS - 1),
      }),
    );
    await stale.service.authenticate(TOKEN);
    expect(stale.prisma.mcpToken.updateMany).toHaveBeenCalledOnce();
  });
});

describe("McpTokenService.revoke", () => {
  const actor = { ...owner } as AuthenticatedUser;

  it("revokes the actor's own token and logs it", async () => {
    const { service, audit } = serviceWith(tokenRow());
    const revoked = await service.revoke(actor, "token-1");
    expect(revoked.revokedAt).toBeInstanceOf(Date);
    expect(audit.log).toHaveBeenCalledOnce();
  });

  it("treats someone else's token as missing", async () => {
    const { service, prisma } = serviceWith(tokenRow({ userId: "someone" }));
    await expect(service.revoke(actor, "token-1")).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.mcpToken.update).not.toHaveBeenCalled();
  });
});

describe("McpTokenService.create", () => {
  it("stores the hash, never the token, and returns the token once", async () => {
    const { service, prisma } = serviceWith(null);
    const created = await service.create({ ...owner } as AuthenticatedUser, {
      name: "  Claude  ",
    });
    const { data } = prisma.mcpToken.create.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(data.name).toBe("Claude");
    expect(data.tokenHash).toBe(hashMcpToken(created.token));
    expect(Object.values(data)).not.toContain(created.token);
  });
});
