import { AuditAction, CmsRole, CmsUserStatus } from "@loom/database";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { AuditService } from "../audit/audit.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import type { PasswordLinkService } from "../auth/password-link.service";
import type { SessionService } from "../auth/session.service";
import type { PrismaService } from "../prisma/prisma.service";
import { UserService } from "./user.service";

const actor: AuthenticatedUser = {
  id: "admin-1",
  email: "admin@example.com",
  name: "Admin",
  role: CmsRole.ADMIN,
  status: CmsUserStatus.ACTIVE,
};

const LINK = {
  token: "link-token",
  expiresAt: new Date("2026-12-03T12:00:00Z"),
};

const userRow = (overrides: object = {}) => ({
  id: "user-2",
  email: "wren@example.com",
  name: "Wren",
  role: CmsRole.WRITER,
  status: CmsUserStatus.ACTIVE,
  createdAt: new Date(),
  lastActiveAt: null,
  passwordLink: null,
  ...overrides,
});

function setup({
  existing = userRow() as ReturnType<typeof userRow> | null,
  hasPassword = true,
} = {}) {
  const prisma = {
    cmsUser: {
      findUnique: vi.fn(async () => existing),
      create: vi.fn(async ({ data }: { data: object }) => userRow(data)),
      update: vi.fn(async ({ data }: { data: object }) =>
        userRow({ ...existing, ...data }),
      ),
      count: vi.fn(async () => 1),
    },
    cmsPassword: {
      findUnique: vi.fn(async () =>
        hasPassword ? { userId: "user-2" } : null,
      ),
    },
    cmsPasswordLink: { deleteMany: vi.fn(async () => ({ count: 1 })) },
    $transaction: vi.fn(async (work: (tx: unknown) => unknown) => work(prisma)),
  };
  const audit = { log: vi.fn() };
  const passwordLinks = { issue: vi.fn(async () => LINK) };
  const sessions = { revokeAll: vi.fn(async () => undefined) };
  const service = new UserService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
    passwordLinks as unknown as PasswordLinkService,
    sessions as unknown as SessionService,
  );
  return { service, prisma, audit, passwordLinks, sessions };
}

describe("UserService.invite", () => {
  it("adds the person with their role, pending, and hands back their link", async () => {
    const { service, prisma, passwordLinks, audit } = setup({ existing: null });
    const invited = await service.invite(actor, {
      email: "  New.Person@Example.com ",
      name: "  New Person ",
      role: CmsRole.AUTHOR,
    });

    expect(prisma.cmsUser.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          email: "new.person@example.com",
          name: "New Person",
          role: CmsRole.AUTHOR,
        },
      }),
    );
    expect(passwordLinks.issue).toHaveBeenCalledWith("user-2", prisma);
    expect(invited.link).toBe(LINK);
    expect(invited.user.passwordLinkExpiresAt).toBe(LINK.expiresAt);
    expect(audit.log).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({ action: AuditAction.USER_INVITED }),
    );
  });

  it("refuses an email that already has an account", async () => {
    const { service, prisma } = setup();
    await expect(
      service.invite(actor, {
        email: "WREN@example.com",
        role: CmsRole.WRITER,
      }),
    ).rejects.toThrow(ConflictException);
    expect(prisma.cmsUser.create).not.toHaveBeenCalled();
  });
});

describe("UserService.createPasswordLink", () => {
  it.each([
    [
      "re-invites someone who never chose a password",
      CmsUserStatus.PENDING,
      AuditAction.USER_INVITED,
    ],
    [
      "resets the password of someone active",
      CmsUserStatus.ACTIVE,
      AuditAction.USER_PASSWORD_RESET,
    ],
  ])("%s", async (_, status, action) => {
    const { service, audit } = setup({ existing: userRow({ status }) });
    await expect(service.createPasswordLink(actor, "user-2")).resolves.toBe(
      LINK,
    );
    expect(audit.log).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({ action }),
    );
  });

  it("refuses a disabled account", async () => {
    const { service, passwordLinks } = setup({
      existing: userRow({ status: CmsUserStatus.DISABLED }),
    });
    await expect(service.createPasswordLink(actor, "user-2")).rejects.toThrow(
      BadRequestException,
    );
    expect(passwordLinks.issue).not.toHaveBeenCalled();
  });
});

describe("UserService.updateStatus", () => {
  it("signs a disabled person out at once and voids their link", async () => {
    const { service, prisma, sessions } = setup();
    const updated = await service.updateStatus(
      actor,
      "user-2",
      CmsUserStatus.DISABLED,
    );
    expect(prisma.cmsPasswordLink.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-2" },
    });
    expect(sessions.revokeAll).toHaveBeenCalledWith("user-2", { tx: prisma });
    expect(updated.status).toBe(CmsUserStatus.DISABLED);
  });

  it.each([
    ["able to sign in again with their password", true, CmsUserStatus.ACTIVE],
    [
      "still waiting for a link if they never chose one",
      false,
      CmsUserStatus.PENDING,
    ],
  ])("reactivates someone %s", async (_, hasPassword, status) => {
    const { service } = setup({
      existing: userRow({ status: CmsUserStatus.DISABLED }),
      hasPassword,
    });
    const updated = await service.updateStatus(
      actor,
      "user-2",
      CmsUserStatus.ACTIVE,
    );
    expect(updated.status).toBe(status);
  });
});

describe("UserService.updateRole", () => {
  it("changes only the role: having one no longer activates an account", async () => {
    const { service, prisma } = setup({
      existing: userRow({ status: CmsUserStatus.PENDING }),
    });
    await service.updateRole(actor, "user-2", CmsRole.AUTHOR);
    expect(prisma.cmsUser.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { role: CmsRole.AUTHOR } }),
    );
  });
});
