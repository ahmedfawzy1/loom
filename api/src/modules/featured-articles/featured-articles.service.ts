import {
  AuditAction,
  CmsContentType,
  type FeaturedArticles,
  type FeaturedArticlesVersion,
  type SiteLanguage,
  type Space,
} from "@loom/database";
import type { UpdateFeaturedArticlesRequestDto } from "@loom/dto";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import { ContentContextService } from "../content/content-context.service";
import { type LocaleSaveOptions, saveNote } from "../content/content-item.util";
import type { FeaturedArticlesSnapshot } from "../content/snapshot.util";
import { VersionService } from "../content/version.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class FeaturedArticlesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly context: ContentContextService,
    private readonly versions: VersionService,
  ) {}

  /** One list per Space, created with the Space, so this reads rather than upserts. */
  async get(spaceId: Space["id"]) {
    const featured = await this.prisma.featuredArticles.findUnique({
      where: { spaceId },
      include: {
        locales: {
          orderBy: { languageCode: "asc" },
          include: { items: { orderBy: { position: "asc" } } },
        },
      },
    });
    if (!featured)
      throw new NotFoundException(
        `Space ${spaceId} has no featured articles list`,
      );

    return {
      id: featured.id,
      spaceId: featured.spaceId,
      locales: featured.locales.map((locale) => ({
        ...locale,
        blogIds: locale.items.map((item) => item.blogId),
      })),
    };
  }

  async updateLocale(
    actor: AuthenticatedUser,
    spaceId: Space["id"],
    languageCode: SiteLanguage["code"],
    args: UpdateFeaturedArticlesRequestDto,
    options: Pick<LocaleSaveOptions<never>, "restoredFrom"> = {},
  ) {
    await this.context.requireLanguage(spaceId, languageCode);

    const unique = new Set(args.blogIds);
    if (unique.size !== args.blogIds.length)
      throw new BadRequestException("The same post is listed twice");

    const inSpace = await this.prisma.blog.count({
      where: { id: { in: args.blogIds }, spaceId, deletedAt: null },
    });
    if (inSpace !== args.blogIds.length)
      throw new BadRequestException(
        "One of those posts is not in this Space, or is in the Trash",
      );

    const featured = await this.get(spaceId);

    await this.prisma.$transaction(async (tx) => {
      const locale = await tx.featuredArticlesLocale.upsert({
        where: {
          featuredArticlesId_languageCode: {
            featuredArticlesId: featured.id,
            languageCode,
          },
        },
        create: {
          featuredArticlesId: featured.id,
          spaceId,
          languageCode,
        },
        update: {},
      });

      // Ordered, so the set is replaced rather than diffed
      await tx.featuredArticlesItem.deleteMany({
        where: { localeId: locale.id },
      });
      await tx.featuredArticlesItem.createMany({
        data: args.blogIds.map((blogId, position) => ({
          localeId: locale.id,
          blogId,
          position,
        })),
      });
      await this.versions.commit(
        tx,
        CmsContentType.FEATURED_ARTICLES,
        locale.id,
        actor,
        saveNote(options, languageCode),
      );
    });

    await this.auditService.log(actor, {
      action: options.restoredFrom
        ? AuditAction.VERSION_RESTORED
        : AuditAction.CONTENT_EDITED,
      contentType: CmsContentType.FEATURED_ARTICLES,
      contentId: featured.id,
      languageCode,
      spaceId,
      metadata: options.restoredFrom
        ? { revision: options.restoredFrom }
        : { count: args.blogIds.length },
    });

    return this.get(spaceId);
  }

  /**
   * Saves an old list again as the newest one. A post trashed since that version was saved makes
   * the restore fail with the same message a save would give, rather than being dropped silently.
   */
  async restoreVersion(
    actor: AuthenticatedUser,
    featuredArticlesId: FeaturedArticles["id"],
    languageCode: SiteLanguage["code"],
    revision: FeaturedArticlesVersion["revision"],
  ) {
    const featured = await this.prisma.featuredArticles.findUnique({
      where: { id: featuredArticlesId },
    });
    if (!featured)
      throw new NotFoundException(
        `Featured articles ${featuredArticlesId} not found`,
      );
    const { snapshot } = await this.versions.get(
      CmsContentType.FEATURED_ARTICLES,
      featuredArticlesId,
      languageCode,
      revision,
    );
    const restored = snapshot as unknown as FeaturedArticlesSnapshot;

    return this.updateLocale(
      actor,
      featured.spaceId,
      languageCode,
      { blogIds: restored.items },
      { restoredFrom: revision },
    );
  }
}
