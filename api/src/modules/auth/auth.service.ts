import { randomBytes } from "node:crypto";
import { CmsUserStatus } from "@loom/database";
import {
  hashPassword,
  hashToken,
  normalizeEmail,
  verifyPassword,
} from "@loom/database/credentials";
import type {
  ChangePasswordRequestDto,
  LoginRequestDto,
  PasswordLinkDetailsResponseDto,
  SetPasswordRequestDto,
} from "@loom/dto";
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  ACCOUNT_DISABLED,
  PASSWORD_LINK_NOT_VALID,
  WRONG_CREDENTIALS,
} from "./auth.constants";
import {
  AUTHENTICATED_USER_SELECT,
  type AuthenticatedUser,
} from "./auth.types";
import {
  emailThrottleKey,
  ipThrottleKey,
  LoginThrottle,
  type ThrottleKey,
} from "./login-throttle";
import { PasswordLinkService } from "./password-link.service";
import { SessionService } from "./session.service";

/** Someone who has just proved who they are, and the token of the session that began. */
interface SignedIn {
  user: AuthenticatedUser;
  token: string;
}

@Injectable()
export class AuthService {
  // Checked when an email matches nobody, so a wrong email takes as long as a wrong password and
  // the response time never says who has an account
  private decoyHash?: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly passwordLinks: PasswordLinkService,
    private readonly throttle: LoginThrottle,
  ) {}

  async login(args: LoginRequestDto, ip?: string): Promise<SignedIn> {
    const email = normalizeEmail(args.email);
    const keys = [emailThrottleKey(email), ...(ip ? [ipThrottleKey(ip)] : [])];
    this.assertNotThrottled(keys);

    const found = await this.prisma.cmsUser.findUnique({
      where: { email },
      select: {
        ...AUTHENTICATED_USER_SELECT,
        password: { select: { hash: true } },
      },
    });
    const stored = found?.password?.hash;
    const matches = await verifyPassword(
      args.password,
      stored ?? (await this.decoy()),
    );
    if (!found || !stored || !matches) {
      this.throttle.recordFailure(keys);
      throw new UnauthorizedException(WRONG_CREDENTIALS);
    }

    // Only after the password matched, so this says nothing to someone guessing
    if (found.status !== CmsUserStatus.ACTIVE)
      throw new ForbiddenException(ACCOUNT_DISABLED);

    this.throttle.clear(emailThrottleKey(email));
    const user: AuthenticatedUser = {
      id: found.id,
      email: found.email,
      name: found.name,
      role: found.role,
      status: found.status,
    };
    return { user, token: await this.sessions.create(user.id) };
  }

  /** What the set-password page shows about a link before anything is typed. */
  async passwordLinkDetails(
    token: string,
  ): Promise<PasswordLinkDetailsResponseDto> {
    const link = await this.passwordLinks.find(token);
    return {
      email: link.user.email,
      name: link.user.name,
      isInvite: !link.user.password,
      expiresAt: link.expiresAt,
    };
  }

  /** Chooses a password through a link, which activates an invited account, and signs in. */
  async setPassword(args: SetPasswordRequestDto): Promise<SignedIn> {
    const link = await this.passwordLinks.find(args.token);
    // Outside the transaction: it is the slow part, and holds no locks
    const hash = await hashPassword(args.password);
    const now = new Date();

    // Rows are touched link first, as disabling an account does, so the two never deadlock
    const user = await this.prisma.$transaction(async (tx) => {
      // Spending the link is what makes it single-use, even when it is sent twice at once. Disabling
      // an account deletes its link, so a disabled account cannot get past this either.
      const spent = await tx.cmsPasswordLink.deleteMany({
        where: { tokenHash: hashToken(args.token), expiresAt: { gt: now } },
      });
      if (!spent.count) throw new BadRequestException(PASSWORD_LINK_NOT_VALID);

      await tx.cmsPassword.upsert({
        where: { userId: link.userId },
        create: { userId: link.userId, hash },
        update: { hash },
      });
      // A new password signs out every browser that was signed in with the old one
      await this.sessions.revokeAll(link.userId, { tx });
      return tx.cmsUser.update({
        where: { id: link.userId },
        data: { status: CmsUserStatus.ACTIVE },
        select: AUTHENTICATED_USER_SELECT,
      });
    });

    // They have just proved who they are, so earlier wrong guesses no longer stand against them
    this.throttle.clear(emailThrottleKey(user.email));
    return { user, token: await this.sessions.create(user.id) };
  }

  /** Replaces the signed-in person's password. Their other sessions end; this one carries on. */
  async changePassword(
    actor: AuthenticatedUser,
    sessionToken: string,
    args: ChangePasswordRequestDto,
  ): Promise<void> {
    // Guessing the current password here is guessing it at sign-in, so it counts the same way
    const keys = [emailThrottleKey(actor.email)];
    this.assertNotThrottled(keys);

    const stored = await this.prisma.cmsPassword.findUnique({
      where: { userId: actor.id },
    });
    if (!stored || !(await verifyPassword(args.currentPassword, stored.hash))) {
      this.throttle.recordFailure(keys);
      // Not a 401: they are signed in, and the admin app answers a 401 by sending them to sign in
      throw new BadRequestException("Your current password isn't right");
    }

    const hash = await hashPassword(args.newPassword);
    await this.prisma.$transaction(async (tx) => {
      // A reset link an Admin sent is moot once they have chosen a password themselves
      await tx.cmsPasswordLink.deleteMany({ where: { userId: actor.id } });
      await tx.cmsPassword.update({
        where: { userId: actor.id },
        data: { hash },
      });
      await this.sessions.revokeAll(actor.id, { keepToken: sessionToken, tx });
    });
  }

  private assertNotThrottled(keys: readonly ThrottleKey[]) {
    const wait = this.throttle.retryAfterMs(keys);
    if (!wait) return;
    const minutes = Math.ceil(wait / 60_000);
    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: "Too Many Requests",
        message: `Too many failed attempts. Try again in ${minutes === 1 ? "a minute" : `${minutes} minutes`}.`,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private decoy(): Promise<string> {
    this.decoyHash ??= hashPassword(randomBytes(16).toString("hex"));
    return this.decoyHash;
  }
}
