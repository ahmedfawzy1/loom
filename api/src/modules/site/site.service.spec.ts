import { AuditAction } from "@loom/database";
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { describe, expect, it, vi } from "vitest";
import type { ApiKeyService } from "../api-key/api-key.service";
import type { AuditService } from "../audit/audit.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import type { PrismaService } from "../prisma/prisma.service";
import type { RevalidateService } from "../revalidate/revalidate.service";
import { SiteService } from "./site.service";

const actor = { id: "user-1", email: "admin@example.com" } as AuthenticatedUser;
const site = {
  id: "site-1",
  name: "Acme Blog",
  slug: "acme",
  spaces: [{ name: "Production" }, { name: "Staging" }],
  languages: [],
};

function setup({ otherSites = 1, slugTaken = false } = {}) {
  const prisma = {
    site: {
      findUnique: vi.fn(
        async ({ where }: { where: { id?: string; slug?: string } }) => {
          if (where.id) return where.id === site.id ? site : null;
          return slugTaken ? { id: "site-taken" } : null;
        },
      ),
      count: vi.fn(async () => otherSites),
      delete: vi.fn(async () => site),
      create: vi.fn(async () => site),
    },
  };
  const auditService = { log: vi.fn(async () => {}) };
  const apiKeyService = { forgetSite: vi.fn() };
  const service = new SiteService(
    prisma as unknown as PrismaService,
    auditService as unknown as AuditService,
    {} as ConfigService,
    {} as RevalidateService,
    apiKeyService as unknown as ApiKeyService,
  );
  return { service, prisma, auditService, apiKeyService };
}

describe("SiteService.deleteSite", () => {
  it("refuses unless the name is typed exactly", async () => {
    const { service, prisma } = setup();
    await expect(
      service.deleteSite(actor, site.id, "acme blog"),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.site.delete).not.toHaveBeenCalled();
  });

  it("refuses to delete the last Site", async () => {
    const { service, prisma } = setup({ otherSites: 0 });
    await expect(service.deleteSite(actor, site.id, site.name)).rejects.toThrow(
      "Loom must keep at least one Site",
    );
    expect(prisma.site.delete).not.toHaveBeenCalled();
  });

  it("404s a Site that does not exist", async () => {
    const { service } = setup();
    await expect(service.deleteSite(actor, "nope", site.name)).rejects.toThrow(
      NotFoundException,
    );
  });

  it("deletes, drops its API keys from memory, and records what went", async () => {
    const { service, prisma, apiKeyService, auditService } = setup();
    await service.deleteSite(actor, site.id, site.name);

    expect(prisma.site.delete).toHaveBeenCalledWith({ where: { id: site.id } });
    expect(apiKeyService.forgetSite).toHaveBeenCalledWith(site.id);
    expect(auditService.log).toHaveBeenCalledWith(actor, {
      action: AuditAction.SITE_DELETED,
      contentId: site.id,
      metadata: {
        name: site.name,
        slug: site.slug,
        spaces: ["Production", "Staging"],
      },
    });
  });
});

describe("SiteService.createSite", () => {
  const args = { name: "New", slug: "new-site", domain: "example.com" };

  it("refuses a default language a new Site would not have", async () => {
    const { service, prisma } = setup();
    await expect(
      service.createSite(actor, { ...args, defaultLanguage: "xx" }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.site.create).not.toHaveBeenCalled();
  });

  it("names the slug when it is already taken", async () => {
    const { service, prisma } = setup({ slugTaken: true });
    await expect(service.createSite(actor, args)).rejects.toThrow(
      new ConflictException('A Site with the slug "new-site" already exists'),
    );
    expect(prisma.site.create).not.toHaveBeenCalled();
  });
});
