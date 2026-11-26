import { UnauthorizedException } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuditService } from "../audit/audit.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import type { PrismaService } from "../prisma/prisma.service";
import { API_KEY_RELOAD_INTERVAL_MS } from "./api-key.constants";
import { ApiKeyService } from "./api-key.service";
import { hashApiKey } from "./api-key.util";

const KEY = "loom_known";
const row = {
  id: "key-1",
  siteId: "site-1",
  name: "Website",
  keyHash: hashApiKey(KEY),
  keyPrefix: "loom_known",
  rateLimitPerMinute: 600,
  lastUsedAt: new Date(),
  revokedAt: null as Date | null,
  createdById: null,
  createdAt: new Date(),
  site: { slug: "demo" },
  createdBy: null,
};

/** A Prisma whose key listing waits until released, holding a reload open on purpose. */
function slowPrisma(listed: (typeof row)[]) {
  let release = () => {};
  const prisma = {
    apiKey: {
      findMany: vi.fn(
        () =>
          new Promise<(typeof row)[]>((resolve) => {
            release = () => resolve(listed);
          }),
      ),
      findUnique: vi.fn(async () => ({ ...row })),
      update: vi.fn(async () => ({ ...row, revokedAt: new Date() })),
      create: vi.fn(async ({ data }: { data: object }) => ({
        ...row,
        ...data,
      })),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    site: {
      findUnique: vi.fn(async () => ({ id: "site-1", slug: "demo" })),
    },
  };
  return { prisma, release: () => release() };
}

const audit = { log: vi.fn() } as unknown as AuditService;
const actor = { id: "user-1", email: "a@b.c" } as AuthenticatedUser;
let service: ApiKeyService;

/** Loaded with `listed`, then a reload started and held open until `release`. */
async function midReload(listed: (typeof row)[]) {
  vi.useFakeTimers();
  const { prisma, release } = slowPrisma(listed);
  service = new ApiKeyService(prisma as unknown as PrismaService, audit);
  const init = service.onModuleInit();
  release();
  await init;
  vi.advanceTimersByTime(API_KEY_RELOAD_INTERVAL_MS);
  return async () => {
    release();
    await vi.advanceTimersByTimeAsync(0);
  };
}

afterEach(() => {
  service.onModuleDestroy();
  vi.useRealTimers();
});

describe("ApiKeyService's keys in memory", () => {
  it("a revoke during a reload is not undone by it", async () => {
    const finishReload = await midReload([{ ...row }]);
    await expect(service.authenticate(KEY, "demo")).resolves.toBeTruthy();

    await service.revoke(actor, row.id);
    await finishReload(); // it read the key while it was still live

    await expect(service.authenticate(KEY, "demo")).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("a key created during a reload keeps working after it", async () => {
    const finishReload = await midReload([]);
    const created = await service.create(actor, "site-1", { name: "New" });
    await finishReload(); // it read the list before the key existed

    await expect(
      service.authenticate(created.key, "demo"),
    ).resolves.toBeTruthy();
  });

  it("another Site's key is refused", async () => {
    const finishReload = await midReload([{ ...row }]);
    await finishReload();
    await expect(service.authenticate(KEY, "other-site")).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
