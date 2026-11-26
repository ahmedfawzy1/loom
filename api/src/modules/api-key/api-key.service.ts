import { type ApiKey, AuditAction, type Site } from "@loom/database";
import type {
  ApiKeyResponseDto,
  CreateApiKeyRequestDto,
  CreatedApiKeyResponseDto,
} from "@loom/dto";
import {
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleDestroy,
  type OnModuleInit,
  UnauthorizedException,
} from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import {
  API_KEY_RELOAD_INTERVAL_MS,
  API_KEY_TOUCH_INTERVAL_MS,
} from "./api-key.constants";
import { generateApiKey, hashApiKey } from "./api-key.util";

const API_KEY_INCLUDE = {
  createdBy: { select: { id: true, email: true, name: true } },
} as const;

/** A key that works, with the Site it works for. */
type ActiveKey = ApiKey & { site: Pick<Site, "slug"> };

@Injectable()
export class ApiKeyService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ApiKeyService.name);

  /**
   * Every key that works, by hash. A Site has a handful and cms-api is one instance, so the
   * Content API authenticates from memory: a request with a key that does not exist costs a hash
   * and a lookup, never a database query. Create and revoke keep it current at once.
   */
  private active = new Map<ApiKey["keyHash"], ActiveKey>();
  // Moves on every create and revoke, so a reload that started before one is thrown away
  private generation = 0;
  private reloader?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async onModuleInit() {
    await this.reload();
    // Catches what did not go through this process: a deleted Site's keys, a row edited by hand
    this.reloader = setInterval(
      () =>
        this.reload().catch((error: unknown) =>
          this.logger.warn(`Could not reload API keys: ${String(error)}`),
        ),
      API_KEY_RELOAD_INTERVAL_MS,
    );
    this.reloader.unref();
  }

  onModuleDestroy() {
    clearInterval(this.reloader);
  }

  list(siteId: Site["id"]): Promise<ApiKeyResponseDto[]> {
    return this.prisma.apiKey.findMany({
      where: { siteId },
      include: API_KEY_INCLUDE,
      orderBy: [
        { revokedAt: { sort: "desc", nulls: "first" } },
        { createdAt: "desc" },
      ],
    });
  }

  async create(
    actor: AuthenticatedUser,
    siteId: Site["id"],
    args: CreateApiKeyRequestDto,
  ): Promise<CreatedApiKeyResponseDto> {
    const site = await this.prisma.site.findUnique({ where: { id: siteId } });
    if (!site) throw new NotFoundException(`Site ${siteId} not found`);

    const { key, keyHash, keyPrefix } = generateApiKey();
    const created = await this.prisma.apiKey.create({
      data: {
        siteId,
        name: args.name.trim(),
        keyHash,
        keyPrefix,
        rateLimitPerMinute: args.rateLimitPerMinute,
        canPreview: args.canPreview ?? false,
        createdById: actor.id,
      },
      include: API_KEY_INCLUDE,
    });

    this.active.set(keyHash, { ...created, site: { slug: site.slug } });
    this.generation++;

    await this.auditService.log(actor, {
      action: AuditAction.API_KEY_CREATED,
      metadata: {
        siteId,
        apiKeyId: created.id,
        name: created.name,
        keyPrefix,
        canPreview: created.canPreview,
      },
    });

    return { ...created, key };
  }

  /** Revoking is final: a revoked key is kept for the record and never works again. */
  async revoke(
    actor: AuthenticatedUser,
    apiKeyId: ApiKey["id"],
  ): Promise<ApiKeyResponseDto> {
    const existing = await this.prisma.apiKey.findUnique({
      where: { id: apiKeyId },
      include: API_KEY_INCLUDE,
    });
    if (!existing) throw new NotFoundException(`API key ${apiKeyId} not found`);
    if (existing.revokedAt) {
      // Revoked some other way — by hand, say — so it may still be in memory
      this.active.delete(existing.keyHash);
      return existing;
    }

    const revoked = await this.prisma.apiKey.update({
      where: { id: apiKeyId },
      data: { revokedAt: new Date() },
      include: API_KEY_INCLUDE,
    });
    this.active.delete(revoked.keyHash);
    this.generation++;

    await this.auditService.log(actor, {
      action: AuditAction.API_KEY_REVOKED,
      metadata: {
        siteId: revoked.siteId,
        apiKeyId,
        name: revoked.name,
        keyPrefix: revoked.keyPrefix,
      },
    });

    return revoked;
  }

  /**
   * Drops a deleted Site's keys from memory at once. The database rows are already gone with the
   * Site, but without this they would keep authenticating until the next reload — and against a new
   * Site created with the same slug in the meantime, since authenticate compares slugs.
   */
  forgetSite(siteId: Site["id"]) {
    for (const [keyHash, apiKey] of this.active)
      if (apiKey.siteId === siteId) this.active.delete(keyHash);
    this.generation++;
  }

  /**
   * The key behind a Content API request. It must be live and belong to the Site in the URL: a key
   * is issued per Site, so one Site's key reads nothing of another's. Every failure is the same 401,
   * so the answer never says whether a key exists.
   */
  async authenticate(key: string, siteSlug: Site["slug"]): Promise<ApiKey> {
    const apiKey = this.active.get(hashApiKey(key));
    if (!apiKey || apiKey.site.slug !== siteSlug)
      throw new UnauthorizedException("Invalid API key");

    const now = new Date();
    if (
      !apiKey.lastUsedAt ||
      now.getTime() - apiKey.lastUsedAt.getTime() > API_KEY_TOUCH_INTERVAL_MS
    ) {
      // Set first, so the requests arriving meanwhile do not each write it too
      apiKey.lastUsedAt = now;
      // Many, not one: a key whose row went outside this process is still in memory until the
      // next reload, and must not turn a request into an error
      await this.prisma.apiKey.updateMany({
        where: { id: apiKey.id },
        data: { lastUsedAt: now },
      });
    }
    return apiKey;
  }

  private async reload() {
    const generation = this.generation;
    const keys = await this.prisma.apiKey.findMany({
      where: { revokedAt: null },
      include: { site: { select: { slug: true } } },
    });
    // A create or revoke landed while this was reading, and already updated the map; replacing it
    // with what was read before would undo that — a revoked key working again for five minutes
    if (generation !== this.generation) return;
    this.active = new Map(keys.map((apiKey) => [apiKey.keyHash, apiKey]));
  }
}
