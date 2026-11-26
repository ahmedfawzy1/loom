import { AuditAction, CmsUserStatus, type McpToken } from "@loom/database";
import type {
  CreatedMcpTokenResponseDto,
  CreateMcpTokenRequestDto,
  McpTokenResponseDto,
} from "@loom/dto";
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import { LAST_ACTIVE_WRITE_INTERVAL_MS } from "../auth/auth.constants";
import type { AuthenticatedUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import {
  MCP_TOKEN_PREFIX,
  MCP_TOKEN_TOUCH_INTERVAL_MS,
} from "./mcp-token.constants";
import {
  generateMcpToken,
  hashMcpToken,
  mcpTokenExpiry,
} from "./mcp-token.util";

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  status: true,
  lastActiveAt: true,
} as const;

// One answer for every token that does not work, so it never says whether a token exists
const INVALID_TOKEN =
  "That MCP token is not valid, or has expired or been revoked";

/**
 * Personal tokens for the MCP endpoint. Each person manages their own: a token acts as the person
 * who made it, so nobody else, an Admin included, needs to see or hold one.
 */
@Injectable()
export class McpTokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  list(actor: AuthenticatedUser): Promise<McpTokenResponseDto[]> {
    return this.prisma.mcpToken.findMany({
      where: { userId: actor.id },
      orderBy: [
        { revokedAt: { sort: "desc", nulls: "first" } },
        { createdAt: "desc" },
      ],
    });
  }

  async create(
    actor: AuthenticatedUser,
    args: CreateMcpTokenRequestDto,
  ): Promise<CreatedMcpTokenResponseDto> {
    const { token, tokenHash, tokenPrefix } = generateMcpToken();
    const created = await this.prisma.mcpToken.create({
      data: {
        userId: actor.id,
        name: args.name.trim(),
        tokenHash,
        tokenPrefix,
        expiresAt: mcpTokenExpiry(new Date()),
      },
    });

    await this.auditService.log(actor, {
      action: AuditAction.MCP_TOKEN_CREATED,
      metadata: { mcpTokenId: created.id, name: created.name, tokenPrefix },
    });

    return { ...created, token };
  }

  /** Revoking is final: a revoked token is kept for the record and never works again. */
  async revoke(
    actor: AuthenticatedUser,
    tokenId: McpToken["id"],
  ): Promise<McpTokenResponseDto> {
    const existing = await this.prisma.mcpToken.findUnique({
      where: { id: tokenId },
    });
    // Someone else's token reads as missing, the same as one that never existed
    if (!existing || existing.userId !== actor.id)
      throw new NotFoundException(`MCP token ${tokenId} not found`);
    if (existing.revokedAt) return existing;

    const revoked = await this.prisma.mcpToken.update({
      where: { id: tokenId },
      data: { revokedAt: new Date() },
    });

    await this.auditService.log(actor, {
      action: AuditAction.MCP_TOKEN_REVOKED,
      metadata: {
        mcpTokenId: tokenId,
        name: revoked.name,
        tokenPrefix: revoked.tokenPrefix,
      },
    });

    return revoked;
  }

  /**
   * The person an MCP request acts as. The token must be live, and its owner must still be someone
   * who could sign in: a disabled account gets nothing through a token it made earlier.
   */
  async authenticate(token: string): Promise<AuthenticatedUser> {
    if (!token.startsWith(MCP_TOKEN_PREFIX))
      throw new UnauthorizedException(INVALID_TOKEN);

    const found = await this.prisma.mcpToken.findUnique({
      where: { tokenHash: hashMcpToken(token) },
      include: { user: { select: USER_SELECT } },
    });
    const now = new Date();
    if (!found || found.revokedAt || found.expiresAt <= now)
      throw new UnauthorizedException(INVALID_TOKEN);

    const { user } = found;
    if (user.status === CmsUserStatus.DISABLED)
      throw new ForbiddenException("This CMS account is disabled");
    // Only an account that has never chosen a password is neither, and it could not have made a
    // token; this is the backstop
    if (user.status !== CmsUserStatus.ACTIVE)
      throw new ForbiddenException("This CMS account is not active");

    await this.touch(found, user, now);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
    };
  }

  /** Bookkeeping for the token list and the Users screen, written at most once a minute. */
  private async touch(
    token: McpToken,
    user: { id: string; lastActiveAt: Date | null },
    now: Date,
  ) {
    const writes: Promise<unknown>[] = [];
    if (
      !token.lastUsedAt ||
      now.getTime() - token.lastUsedAt.getTime() > MCP_TOKEN_TOUCH_INTERVAL_MS
    )
      // Many, not one: a token revoked a moment ago must not turn this request into an error
      writes.push(
        this.prisma.mcpToken.updateMany({
          where: { id: token.id },
          data: { lastUsedAt: now },
        }),
      );
    if (
      !user.lastActiveAt ||
      now.getTime() - user.lastActiveAt.getTime() >
        LAST_ACTIVE_WRITE_INTERVAL_MS
    )
      writes.push(
        this.prisma.cmsUser.update({
          where: { id: user.id },
          data: { lastActiveAt: now },
        }),
      );
    await Promise.all(writes);
  }
}
