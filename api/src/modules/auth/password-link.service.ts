import { type CmsUser, CmsUserStatus, type Prisma } from "@loom/database";
import { hashToken, newPasswordLink } from "@loom/database/credentials";
import type { PasswordLinkResponseDto } from "@loom/dto";
import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PASSWORD_LINK_NOT_VALID } from "./auth.constants";
import { AUTHENTICATED_USER_SELECT } from "./auth.types";

/**
 * One-time links to choose a password. An Admin makes one when adding someone and whenever they
 * need a new password; the person who opens it chooses theirs, and the link is spent.
 */
@Injectable()
export class PasswordLinkService {
  constructor(private readonly prisma: PrismaService) {}

  /** A new link for this person, replacing any they had. Its token exists only in the result. */
  async issue(
    userId: CmsUser["id"],
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<PasswordLinkResponseDto> {
    const { token, tokenHash, expiresAt } = newPasswordLink();
    await tx.cmsPasswordLink.upsert({
      where: { userId },
      create: { userId, tokenHash, expiresAt },
      update: { tokenHash, expiresAt, createdAt: new Date() },
    });
    return { token, expiresAt };
  }

  /** The live link a token belongs to, with its person, or the one refusal every dead link gets. */
  async find(token: string, now = new Date()) {
    const link = await this.prisma.cmsPasswordLink.findUnique({
      where: { tokenHash: hashToken(token) },
      include: {
        user: {
          select: {
            ...AUTHENTICATED_USER_SELECT,
            password: { select: { userId: true } },
          },
        },
      },
    });
    if (
      !link ||
      link.expiresAt <= now ||
      link.user.status === CmsUserStatus.DISABLED
    )
      throw new BadRequestException(PASSWORD_LINK_NOT_VALID);
    return link;
  }
}
