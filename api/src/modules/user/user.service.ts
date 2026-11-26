import {
  AuditAction,
  CmsRole,
  type CmsUser,
  CmsUserStatus,
  type Prisma,
} from "@loom/database";
import { normalizeEmail } from "@loom/database/credentials";
import type {
  CmsUserResponseDto,
  InvitedUserResponseDto,
  InviteUserRequestDto,
  PasswordLinkResponseDto,
} from "@loom/dto";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import { PasswordLinkService } from "../auth/password-link.service";
import { SessionService } from "../auth/session.service";
import { PrismaService } from "../prisma/prisma.service";

// What the Users screen shows besides the row itself: whether an unused link is still out there
const USER_RESPONSE_INCLUDE = {
  passwordLink: { select: { expiresAt: true } },
} as const;

type UserWithLink = Prisma.CmsUserGetPayload<{
  include: typeof USER_RESPONSE_INCLUDE;
}>;

const toResponse = ({
  passwordLink,
  ...user
}: UserWithLink): CmsUserResponseDto => ({
  ...user,
  passwordLinkExpiresAt: passwordLink?.expiresAt ?? null,
});

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly passwordLinks: PasswordLinkService,
    private readonly sessions: SessionService,
  ) {}

  directory() {
    return this.prisma.cmsUser.findMany({
      select: { id: true, email: true, name: true },
      orderBy: { email: "asc" },
    });
  }

  async listUsers(): Promise<CmsUserResponseDto[]> {
    const users = await this.prisma.cmsUser.findMany({
      include: USER_RESPONSE_INCLUDE,
      orderBy: [{ status: "asc" }, { email: "asc" }],
    });
    return users.map(toResponse);
  }

  /**
   * Adds someone with the role an Admin chose, and returns the link that lets them choose a
   * password. The account is PENDING until they do; there is no other way to make one.
   */
  async invite(
    actor: AuthenticatedUser,
    args: InviteUserRequestDto,
  ): Promise<InvitedUserResponseDto> {
    const email = normalizeEmail(args.email);
    if (await this.prisma.cmsUser.findUnique({ where: { email } }))
      throw new ConflictException(`${email} already has an account`);

    const { user, link } = await this.prisma.$transaction(async (tx) => {
      const user = await tx.cmsUser.create({
        data: { email, name: args.name?.trim() || null, role: args.role },
        include: USER_RESPONSE_INCLUDE,
      });
      const link = await this.passwordLinks.issue(user.id, tx);
      return { user, link };
    });

    await this.auditService.log(actor, {
      action: AuditAction.USER_INVITED,
      contentId: user.id,
      metadata: { email, role: user.role },
    });

    return {
      user: { ...toResponse(user), passwordLinkExpiresAt: link.expiresAt },
      link,
    };
  }

  /**
   * A new link for someone to choose a password: a fresh invite for someone who never used theirs,
   * or a reset for someone who has forgotten their password. Any older link stops working. Their
   * current password, if they have one, works until the link is used.
   */
  async createPasswordLink(
    actor: AuthenticatedUser,
    userId: CmsUser["id"],
  ): Promise<PasswordLinkResponseDto> {
    const user = await this.requireUser(userId);
    if (user.status === CmsUserStatus.DISABLED)
      throw new BadRequestException(
        "Reactivate this account before sending it a password link",
      );

    const link = await this.passwordLinks.issue(user.id);

    await this.auditService.log(actor, {
      action:
        user.status === CmsUserStatus.PENDING
          ? AuditAction.USER_INVITED
          : AuditAction.USER_PASSWORD_RESET,
      contentId: userId,
      metadata: { email: user.email },
    });

    return link;
  }

  async updateRole(
    actor: AuthenticatedUser,
    userId: CmsUser["id"],
    role: CmsUser["role"],
  ): Promise<CmsUserResponseDto> {
    const user = await this.requireUser(userId);

    if (user.id === actor.id && role !== CmsRole.ADMIN)
      throw new BadRequestException("You cannot remove your own Admin role");

    const updated = await this.prisma.$transaction(async (tx) => {
      if (user.role === CmsRole.ADMIN && role !== CmsRole.ADMIN)
        await this.assertNotLastAdmin(tx, user.id);
      // Takes effect on their next request: every request reads the role afresh
      return tx.cmsUser.update({
        where: { id: userId },
        data: { role },
        include: USER_RESPONSE_INCLUDE,
      });
    });

    await this.auditService.log(actor, {
      action: AuditAction.USER_ROLE_CHANGED,
      contentId: userId,
      metadata: { email: user.email, from: user.role, to: role },
    });

    return toResponse(updated);
  }

  async updateStatus(
    actor: AuthenticatedUser,
    userId: CmsUser["id"],
    status: CmsUser["status"],
  ): Promise<CmsUserResponseDto> {
    const user = await this.requireUser(userId);

    if (user.id === actor.id)
      throw new BadRequestException(
        "You cannot change your own account status",
      );

    const updated = await this.prisma.$transaction(async (tx) => {
      if (status === CmsUserStatus.DISABLED) {
        if (user.role === CmsRole.ADMIN)
          await this.assertNotLastAdmin(tx, user.id);
        // Signed out at once, and any link they were sent stops working. The link goes first, the
        // order AuthService.setPassword touches rows in, so the two never deadlock.
        await tx.cmsPasswordLink.deleteMany({ where: { userId } });
        await this.sessions.revokeAll(userId, { tx });
        return tx.cmsUser.update({
          where: { id: userId },
          data: { status: CmsUserStatus.DISABLED },
          include: USER_RESPONSE_INCLUDE,
        });
      }

      // Reactivated, they are back where they were: able to sign in if they have a password, and
      // waiting for a link to choose one if they never did
      const password = await tx.cmsPassword.findUnique({
        where: { userId },
        select: { userId: true },
      });
      return tx.cmsUser.update({
        where: { id: userId },
        data: {
          status: password ? CmsUserStatus.ACTIVE : CmsUserStatus.PENDING,
        },
        include: USER_RESPONSE_INCLUDE,
      });
    });

    await this.auditService.log(actor, {
      action:
        status === CmsUserStatus.DISABLED
          ? AuditAction.USER_DISABLED
          : AuditAction.USER_REACTIVATED,
      contentId: userId,
      metadata: { email: user.email },
    });

    return toResponse(updated);
  }

  async deleteUser(actor: AuthenticatedUser, userId: CmsUser["id"]) {
    const user = await this.requireUser(userId);

    if (user.id === actor.id)
      throw new BadRequestException("You cannot delete your own account");

    // Audited before the row goes, so the entry keeps the email even though userId nulls out
    await this.auditService.log(actor, {
      action: AuditAction.USER_DELETED,
      contentId: userId,
      metadata: { email: user.email, role: user.role },
    });

    // Their password, link and sessions go with the row
    await this.prisma.$transaction(async (tx) => {
      if (user.role === CmsRole.ADMIN)
        await this.assertNotLastAdmin(tx, user.id);
      await tx.cmsUser.delete({ where: { id: userId } });
    });
  }

  private async requireUser(userId: CmsUser["id"]) {
    const user = await this.prisma.cmsUser.findUnique({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException(`User ${userId} not found`);
    return user;
  }

  /**
   * Takes the transaction client rather than `this.prisma`: counting outside the transaction that
   * does the write lets two admins demote each other concurrently and leave the CMS with none.
   * Only ACTIVE Admins count: an invited one cannot sign in until they choose a password.
   */
  private async assertNotLastAdmin(
    tx: Prisma.TransactionClient,
    userId: CmsUser["id"],
  ) {
    const otherAdmins = await tx.cmsUser.count({
      where: {
        id: { not: userId },
        role: CmsRole.ADMIN,
        status: CmsUserStatus.ACTIVE,
      },
    });
    if (otherAdmins === 0)
      throw new BadRequestException(
        "The last Admin cannot be demoted, disabled or deleted",
      );
  }
}
