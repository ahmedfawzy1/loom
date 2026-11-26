import { CmsRole, CmsUserStatus } from "@loom/database";
import {
  hashPassword,
  hashToken,
  verifyPassword,
} from "@loom/database/credentials";
import {
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  UnauthorizedException,
} from "@nestjs/common";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import {
  LOGIN_MAX_FAILURES_PER_EMAIL,
  LOGIN_MAX_FAILURES_PER_IP,
  PASSWORD_LINK_NOT_VALID,
  WRONG_CREDENTIALS,
} from "./auth.constants";
import { AuthService } from "./auth.service";
import {
  emailThrottleKey,
  ipThrottleKey,
  LoginThrottle,
} from "./login-throttle";
import type { PasswordLinkService } from "./password-link.service";
import type { SessionService } from "./session.service";

const PASSWORD = "correct horse battery";
let STORED_HASH: string;

beforeAll(async () => {
  STORED_HASH = await hashPassword(PASSWORD);
});

const ada = {
  id: "user-1",
  email: "ada@example.com",
  name: "Ada",
  role: CmsRole.AUTHOR,
  status: CmsUserStatus.ACTIVE,
};

interface Setup {
  user?: Partial<typeof ada> | null;
  hasPassword?: boolean;
  linkSpent?: boolean;
}

function setup({
  user = {},
  hasPassword = true,
  linkSpent = false,
}: Setup = {}) {
  const found =
    user === null
      ? null
      : {
          ...ada,
          ...user,
          password: hasPassword ? { hash: STORED_HASH } : null,
        };

  const prisma = {
    cmsUser: {
      findUnique: vi.fn(async () => found),
      update: vi.fn(async () => ({ ...ada, status: CmsUserStatus.ACTIVE })),
    },
    cmsPassword: {
      findUnique: vi.fn(async () =>
        hasPassword ? { userId: ada.id, hash: STORED_HASH } : null,
      ),
      upsert: vi.fn(async () => ({})),
      update: vi.fn(async () => ({})),
    },
    cmsPasswordLink: {
      deleteMany: vi.fn(async () => ({ count: linkSpent ? 0 : 1 })),
    },
    $transaction: vi.fn(async (work: (tx: unknown) => unknown) => work(prisma)),
  };
  const sessions = {
    create: vi.fn(async () => "new-session"),
    revokeAll: vi.fn(async () => undefined),
  };
  const passwordLinks = {
    find: vi.fn(async () => ({
      userId: ada.id,
      tokenHash: hashToken("link-token"),
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      user: { ...ada, password: hasPassword ? { userId: ada.id } : null },
    })),
  };
  const throttle = new LoginThrottle();
  const service = new AuthService(
    prisma as unknown as PrismaService,
    sessions as unknown as SessionService,
    passwordLinks as unknown as PasswordLinkService,
    throttle,
  );
  return { service, prisma, sessions, throttle };
}

describe("AuthService.login", () => {
  it("signs in with the right password, and starts a session", async () => {
    const { service, sessions } = setup();
    await expect(
      service.login({ email: ada.email, password: PASSWORD }),
    ).resolves.toEqual({ user: ada, token: "new-session" });
    expect(sessions.create).toHaveBeenCalledWith(ada.id);
  });

  it("looks the email up in its stored form", async () => {
    const { service, prisma } = setup();
    await service.login({ email: "  ADA@Example.com ", password: PASSWORD });
    expect(prisma.cmsUser.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: "ada@example.com" } }),
    );
  });

  it.each<[string, Setup, string]>([
    ["a wrong password", {}, "not the password"],
    ["an email with no account", { user: null }, PASSWORD],
    ["an invite nobody has used", { hasPassword: false }, PASSWORD],
  ])("gives %s the same 401", async (_, options, password) => {
    const { service, sessions } = setup(options);
    const attempt = service.login({ email: ada.email, password });
    await expect(attempt).rejects.toThrow(UnauthorizedException);
    await expect(attempt).rejects.toThrow(WRONG_CREDENTIALS);
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it("says an account is disabled only to someone who knows its password", async () => {
    const { service, sessions } = setup({
      user: { status: CmsUserStatus.DISABLED },
    });
    await expect(
      service.login({ email: ada.email, password: PASSWORD }),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      service.login({ email: ada.email, password: "a wrong guess" }),
    ).rejects.toThrow(WRONG_CREDENTIALS);
    expect(sessions.create).not.toHaveBeenCalled();
  });

  // Failures are mostly recorded straight into the throttle: each real attempt costs a full scrypt
  // check, which is the point of scrypt and too slow to repeat fifty times in a test. One real wrong
  // attempt in each shows login records its failures.
  it("stops taking guesses at an email after too many, even the right one", async () => {
    const { service, prisma, throttle } = setup();
    for (let i = 0; i < LOGIN_MAX_FAILURES_PER_EMAIL - 1; i++)
      throttle.recordFailure([emailThrottleKey(ada.email)]);
    await expect(
      service.login({ email: ada.email, password: "a wrong guess" }),
    ).rejects.toThrow(UnauthorizedException);
    prisma.cmsUser.findUnique.mockClear();

    await expect(
      service.login({ email: ada.email, password: PASSWORD }),
    ).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
    // Refused before any lookup or hash, so a locked-out email costs nothing to keep refusing
    expect(prisma.cmsUser.findUnique).not.toHaveBeenCalled();
  });

  it("counts by client address only when there is one", async () => {
    const { service, throttle } = setup({ user: null });
    for (let i = 0; i < LOGIN_MAX_FAILURES_PER_IP - 1; i++)
      throttle.recordFailure([ipThrottleKey("203.0.113.7")]);
    await expect(
      service.login(
        { email: "guess@example.com", password: "x" },
        "203.0.113.7",
      ),
    ).rejects.toThrow(UnauthorizedException);

    await expect(
      service.login(
        { email: "next@example.com", password: "x" },
        "203.0.113.7",
      ),
    ).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
    await expect(
      service.login({ email: "next@example.com", password: "x" }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("forgets an email's failures once its owner signs in", async () => {
    const { service, throttle } = setup();
    const failAlmostEnough = () => {
      for (let i = 0; i < LOGIN_MAX_FAILURES_PER_EMAIL - 1; i++)
        throttle.recordFailure([emailThrottleKey(ada.email)]);
    };
    failAlmostEnough();
    await service.login({ email: ada.email, password: PASSWORD });

    failAlmostEnough();
    await expect(
      service.login({ email: ada.email, password: PASSWORD }),
    ).resolves.toMatchObject({ user: ada });
  });
});

describe("AuthService.setPassword", () => {
  const NEW_PASSWORD = "a brand new passphrase";

  it("spends the link, stores the new hash, activates the account and signs in", async () => {
    const { service, prisma, sessions } = setup({ hasPassword: false });
    await expect(
      service.setPassword({ token: "link-token", password: NEW_PASSWORD }),
    ).resolves.toMatchObject({ token: "new-session" });

    expect(prisma.cmsPasswordLink.deleteMany).toHaveBeenCalledWith({
      where: {
        tokenHash: hashToken("link-token"),
        expiresAt: { gt: expect.any(Date) },
      },
    });
    const { create } = prisma.cmsPassword.upsert.mock.calls[0][0] as {
      create: { hash: string };
    };
    await expect(verifyPassword(NEW_PASSWORD, create.hash)).resolves.toBe(true);
    expect(sessions.revokeAll).toHaveBeenCalledWith(ada.id, {
      tx: prisma,
    });
    expect(prisma.cmsUser.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: CmsUserStatus.ACTIVE } }),
    );
  });

  it("refuses a link someone used a moment ago, and changes nothing", async () => {
    const { service, prisma, sessions } = setup({ linkSpent: true });
    await expect(
      service.setPassword({ token: "link-token", password: NEW_PASSWORD }),
    ).rejects.toThrow(PASSWORD_LINK_NOT_VALID);
    expect(prisma.cmsPassword.upsert).not.toHaveBeenCalled();
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it("clears earlier wrong guesses, so they can sign in elsewhere at once", async () => {
    const { service, throttle } = setup();
    for (let i = 0; i < LOGIN_MAX_FAILURES_PER_EMAIL; i++)
      throttle.recordFailure([emailThrottleKey(ada.email)]);

    await service.setPassword({ token: "link-token", password: NEW_PASSWORD });
    expect(throttle.retryAfterMs([emailThrottleKey(ada.email)])).toBe(0);
  });
});

describe("AuthService.passwordLinkDetails", () => {
  it.each([
    ["an invite", false, true],
    ["a reset", true, false],
  ])("tells %s apart", async (_, hasPassword, isInvite) => {
    const { service } = setup({ hasPassword });
    await expect(
      service.passwordLinkDetails("link-token"),
    ).resolves.toMatchObject({
      email: ada.email,
      isInvite,
    });
  });
});

describe("AuthService.changePassword", () => {
  it("refuses a wrong current password with a 400, not a 401 that would sign them out", async () => {
    const { service, prisma } = setup();
    const attempt = service.changePassword(ada, "this-session", {
      currentPassword: "not it",
      newPassword: "another passphrase",
    });
    await expect(attempt).rejects.toThrow(BadRequestException);
    expect(prisma.cmsPassword.update).not.toHaveBeenCalled();
  });

  it("replaces the password and signs out every other browser", async () => {
    const { service, prisma, sessions } = setup();
    await service.changePassword(ada, "this-session", {
      currentPassword: PASSWORD,
      newPassword: "another passphrase",
    });

    const { data } = prisma.cmsPassword.update.mock.calls[0][0] as {
      data: { hash: string };
    };
    await expect(verifyPassword("another passphrase", data.hash)).resolves.toBe(
      true,
    );
    expect(sessions.revokeAll).toHaveBeenCalledWith(ada.id, {
      keepToken: "this-session",
      tx: prisma,
    });
    expect(prisma.cmsPasswordLink.deleteMany).toHaveBeenCalledWith({
      where: { userId: ada.id },
    });
  });
});
