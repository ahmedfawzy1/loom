import { type CmsUser, CmsUserStatus, type Prisma } from "@loom/database";
import { generateToken, hashToken } from "@loom/database/credentials";
import { SESSION_COOKIE_NAME } from "@loom/dto/constants";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { CookieOptions, Response } from "express";
import { PrismaService } from "../prisma/prisma.service";
import {
  LAST_ACTIVE_WRITE_INTERVAL_MS,
  SESSION_TTL_MS,
} from "./auth.constants";
import {
  AUTHENTICATED_USER_SELECT,
  type AuthenticatedUser,
} from "./auth.types";

const SESSION_ENDED = "Your session has ended. Sign in again.";

const expiryFrom = (now: Date) => new Date(now.getTime() + SESSION_TTL_MS);

/** Signed-in browsers: the session rows, and the cookie that carries each one's token. */
@Injectable()
export class SessionService {
  private readonly secureCookies: boolean;

  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService,
  ) {
    // A Secure cookie is only ever sent over HTTPS, which a local dev server does not have
    this.secureCookies = configService.get<string>("NODE_ENV") === "production";
  }

  /** Starts a session for someone who has just proved who they are. Returns its token. */
  async create(userId: CmsUser["id"], now = new Date()): Promise<string> {
    const { token, tokenHash } = generateToken();
    await this.prisma.$transaction([
      this.prisma.cmsSession.create({
        data: {
          userId,
          tokenHash,
          expiresAt: expiryFrom(now),
          lastUsedAt: now,
        },
      }),
      this.prisma.cmsUser.update({
        where: { id: userId },
        data: { lastActiveAt: now },
      }),
      // Sessions that ran out are swept away here, so the table holds only live ones
      this.prisma.cmsSession.deleteMany({ where: { expiresAt: { lte: now } } }),
    ]);
    return token;
  }

  /**
   * Who a session token belongs to. `renewed` means its expiry was just pushed back, so the caller
   * should send the cookie again with the new lifetime.
   */
  async authenticate(
    token: string,
    now = new Date(),
  ): Promise<{ user: AuthenticatedUser; renewed: boolean }> {
    const session = await this.prisma.cmsSession.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: { select: AUTHENTICATED_USER_SELECT } },
    });
    if (!session || session.expiresAt <= now)
      throw new UnauthorizedException(SESSION_ENDED);

    const { user } = session;
    // Disabling someone deletes their sessions in the same step; this covers one that began while
    // that was happening
    if (user.status !== CmsUserStatus.ACTIVE) {
      await this.prisma.cmsSession.deleteMany({ where: { id: session.id } });
      throw new UnauthorizedException(SESSION_ENDED);
    }

    const renewed =
      now.getTime() - session.lastUsedAt.getTime() >
      LAST_ACTIVE_WRITE_INTERVAL_MS;
    if (renewed)
      // Many, not one: a session or person removed a moment ago must not turn this into an error
      await this.prisma.$transaction([
        this.prisma.cmsSession.updateMany({
          where: { id: session.id },
          data: { lastUsedAt: now, expiresAt: expiryFrom(now) },
        }),
        this.prisma.cmsUser.updateMany({
          where: { id: user.id },
          data: { lastActiveAt: now },
        }),
      ]);

    return { user, renewed };
  }

  /** Ends the session a token belongs to, if it still exists. */
  async revoke(token: string) {
    await this.prisma.cmsSession.deleteMany({
      where: { tokenHash: hashToken(token) },
    });
  }

  /** Ends every session a person has, except the one whose token is kept. */
  async revokeAll(
    userId: CmsUser["id"],
    {
      keepToken,
      tx = this.prisma,
    }: { keepToken?: string; tx?: Prisma.TransactionClient } = {},
  ) {
    await tx.cmsSession.deleteMany({
      where: {
        userId,
        ...(keepToken && { tokenHash: { not: hashToken(keepToken) } }),
      },
    });
  }

  setCookie(response: Response, token: string) {
    response.cookie(SESSION_COOKIE_NAME, token, {
      ...this.cookieOptions(),
      maxAge: SESSION_TTL_MS,
    });
  }

  clearCookie(response: Response) {
    response.clearCookie(SESSION_COOKIE_NAME, this.cookieOptions());
  }

  private cookieOptions(): CookieOptions {
    return {
      // Out of reach of the page's own scripts, so a script injected into it cannot carry it off
      httpOnly: true,
      secure: this.secureCookies,
      // Left off requests other sites make; SessionGuard also refuses their writes outright
      sameSite: "lax",
      path: "/",
    };
  }
}
