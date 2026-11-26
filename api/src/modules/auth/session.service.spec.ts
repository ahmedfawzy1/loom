import { CmsRole, CmsUserStatus } from "@loom/database";
import { hashToken } from "@loom/database/credentials";
import { SESSION_COOKIE_NAME } from "@loom/dto/constants";
import { UnauthorizedException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { Response } from "express";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import {
  LAST_ACTIVE_WRITE_INTERVAL_MS,
  SESSION_TTL_MS,
} from "./auth.constants";
import { SessionService } from "./session.service";

const NOW = new Date("2026-11-26T12:00:00Z");
const TOKEN = "session-token";

const user = {
  id: "user-1",
  email: "ada@example.com",
  name: "Ada",
  role: CmsRole.WRITER,
  status: CmsUserStatus.ACTIVE,
};

const sessionRow = (overrides: object = {}) => ({
  id: "session-1",
  userId: user.id,
  tokenHash: hashToken(TOKEN),
  expiresAt: new Date(NOW.getTime() + SESSION_TTL_MS / 2),
  lastUsedAt: new Date(NOW.getTime() - 1000),
  createdAt: NOW,
  user: { ...user },
  ...overrides,
});

function serviceWith(
  found: ReturnType<typeof sessionRow> | null,
  nodeEnv = "production",
) {
  const prisma = {
    cmsSession: {
      findUnique: vi.fn(async () => found),
      create: vi.fn(async () => found),
      updateMany: vi.fn(async () => ({ count: 1 })),
      deleteMany: vi.fn(async () => ({ count: 1 })),
    },
    cmsUser: {
      update: vi.fn(async () => user),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    // The array form: each operation has already been started
    $transaction: vi.fn(async (operations: Promise<unknown>[]) =>
      Promise.all(operations),
    ),
  };
  const config = { get: () => nodeEnv };
  const service = new SessionService(
    prisma as unknown as PrismaService,
    config as unknown as ConfigService,
  );
  return { service, prisma };
}

describe("SessionService.create", () => {
  it("stores the token's hash, never the token, for the session's lifetime", async () => {
    const { service, prisma } = serviceWith(null);
    const token = await service.create(user.id, NOW);

    const { data } = prisma.cmsSession.create.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(data.tokenHash).toBe(hashToken(token));
    expect(Object.values(data)).not.toContain(token);
    expect(data.expiresAt).toEqual(new Date(NOW.getTime() + SESSION_TTL_MS));
    expect(prisma.cmsUser.update).toHaveBeenCalledWith({
      where: { id: user.id },
      data: { lastActiveAt: NOW },
    });
  });

  it("sweeps away sessions that have run out", async () => {
    const { service, prisma } = serviceWith(null);
    await service.create(user.id, NOW);
    expect(prisma.cmsSession.deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lte: NOW } },
    });
  });
});

describe("SessionService.authenticate", () => {
  it("acts as the session's person", async () => {
    const { service, prisma } = serviceWith(sessionRow());
    await expect(service.authenticate(TOKEN, NOW)).resolves.toEqual({
      user,
      renewed: false,
    });
    expect(prisma.cmsSession.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tokenHash: hashToken(TOKEN) } }),
    );
    expect(prisma.cmsSession.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    ["an unknown token", null],
    ["a session that ran out", sessionRow({ expiresAt: NOW })],
  ])("refuses %s with a 401", async (_, found) => {
    const { service } = serviceWith(found);
    await expect(service.authenticate(TOKEN, NOW)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it.each([
    ["disabled", CmsUserStatus.DISABLED],
    ["pending", CmsUserStatus.PENDING],
  ])("ends the session of someone %s", async (_, status) => {
    const { service, prisma } = serviceWith(
      sessionRow({ user: { ...user, status } }),
    );
    await expect(service.authenticate(TOKEN, NOW)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(prisma.cmsSession.deleteMany).toHaveBeenCalledWith({
      where: { id: "session-1" },
    });
  });

  it("pushes the expiry back, and records activity, at most every few minutes", async () => {
    const stale = sessionRow({
      lastUsedAt: new Date(NOW.getTime() - LAST_ACTIVE_WRITE_INTERVAL_MS - 1),
    });
    const { service, prisma } = serviceWith(stale);
    await expect(service.authenticate(TOKEN, NOW)).resolves.toMatchObject({
      renewed: true,
    });
    expect(prisma.cmsSession.updateMany).toHaveBeenCalledWith({
      where: { id: "session-1" },
      data: {
        lastUsedAt: NOW,
        expiresAt: new Date(NOW.getTime() + SESSION_TTL_MS),
      },
    });
    expect(prisma.cmsUser.updateMany).toHaveBeenCalledWith({
      where: { id: user.id },
      data: { lastActiveAt: NOW },
    });
  });
});

describe("SessionService.revokeAll", () => {
  it("ends every session but the one kept", async () => {
    const { service, prisma } = serviceWith(null);
    await service.revokeAll(user.id, { keepToken: TOKEN });
    expect(prisma.cmsSession.deleteMany).toHaveBeenCalledWith({
      where: { userId: user.id, tokenHash: { not: hashToken(TOKEN) } },
    });
  });

  it("ends them all when none is kept", async () => {
    const { service, prisma } = serviceWith(null);
    await service.revokeAll(user.id);
    expect(prisma.cmsSession.deleteMany).toHaveBeenCalledWith({
      where: { userId: user.id },
    });
  });
});

describe("the session cookie", () => {
  const response = () => ({ cookie: vi.fn(), clearCookie: vi.fn() });

  it("is out of reach of scripts and other sites, and HTTPS-only in production", () => {
    const { service } = serviceWith(null, "production");
    const res = response();
    service.setCookie(res as unknown as Response, TOKEN);
    expect(res.cookie).toHaveBeenCalledWith(SESSION_COOKIE_NAME, TOKEN, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_MS,
    });
  });

  it("works over plain HTTP on a local dev server", () => {
    const { service } = serviceWith(null, "development");
    const res = response();
    service.setCookie(res as unknown as Response, TOKEN);
    expect(res.cookie.mock.calls[0][2]).toMatchObject({ secure: false });
  });

  it("is cleared with the same attributes it was set with", () => {
    const { service } = serviceWith(null);
    const res = response();
    service.clearCookie(res as unknown as Response);
    expect(res.clearCookie).toHaveBeenCalledWith(SESSION_COOKIE_NAME, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    });
  });
});
