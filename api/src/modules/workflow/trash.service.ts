import {
  AuditAction,
  type Blog,
  CmsContentType,
  CmsRole,
  type Space,
} from "@loom/database";
import type { TrashItemResponseDto } from "@loom/dto";
import { CONTENT_TYPE_LABELS } from "@loom/dto/constants";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import {
  blogBodiesContaining,
  featuredListsContaining,
  liveBlogVersionsContaining,
} from "../content/body-references.util";
import { ContentContextService } from "../content/content-context.service";
import {
  type CanonicalRow,
  canonicalDelegate,
  localeDelegate,
  requireItem,
} from "../content/content-item.util";
import { contentKind } from "../content/content-kind.registry";
import { contentTitle } from "../content/content-title.util";
import { PrismaService } from "../prisma/prisma.service";
import {
  type RevalidateEvent,
  RevalidateService,
} from "../revalidate/revalidate.service";

// Everything that can be trashed: Featured Articles belongs to its Space rather than being an item
const TRASHABLE = [
  CmsContentType.BLOG,
  CmsContentType.CATEGORY,
  CmsContentType.TAG,
  CmsContentType.AUTHOR,
  CmsContentType.CTA,
] as const;

// A purge refusal lists this many blockers; past that, the count says enough
const MAX_LISTED_REFERENCES = 5;

/**
 * Soft delete on the canonical row, so every language goes to the Trash together and
 * comes back together. Trash is kept forever; only a permanent delete removes anything.
 */
@Injectable()
export class TrashService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly context: ContentContextService,
    private readonly revalidate: RevalidateService,
  ) {}

  async trash(
    actor: AuthenticatedUser,
    type: CmsContentType,
    itemId: CanonicalRow["id"],
  ) {
    this.assertTrashable(type);
    const item = await requireItem(this.prisma, type, itemId);
    if (item.deletedAt) return;
    await this.assertMayChangeWhatIsLive(actor, type, itemId);
    const refresh = await this.liveRefresh(type, itemId, item.spaceId);

    await canonicalDelegate(this.prisma, type).update({
      where: { id: itemId },
      data: { deletedAt: new Date() },
    });
    refresh?.("trash");

    await this.auditService.log(actor, {
      action: AuditAction.CONTENT_TRASHED,
      contentType: type,
      contentId: itemId,
      spaceId: item.spaceId,
    });
  }

  /**
   * Nothing can have taken a trashed item's slug in the meantime — a trashed row keeps its slug —
   * so a restore is always possible and never needs a new one.
   */
  async restore(
    actor: AuthenticatedUser,
    type: CmsContentType,
    itemId: CanonicalRow["id"],
  ) {
    this.assertTrashable(type);
    const item = await requireItem(this.prisma, type, itemId);
    if (!item.deletedAt) return;
    await this.assertMayChangeWhatIsLive(actor, type, itemId);
    const refresh = await this.liveRefresh(type, itemId, item.spaceId);

    await canonicalDelegate(this.prisma, type).update({
      where: { id: itemId },
      data: { deletedAt: null },
    });
    refresh?.("restore");

    await this.auditService.log(actor, {
      action: AuditAction.CONTENT_RESTORED,
      contentType: type,
      contentId: itemId,
      spaceId: item.spaceId,
    });
  }

  /**
   * Deletes an item and every language and version of it. Refused while anything still points at
   * it: a post's byline, category or tags, an embed in a post body, a Featured Articles list — in
   * working rows and in every published version, since the website serves those. Trashed posts
   * count too, since restoring one would bring back a reference to nothing.
   */
  async purge(
    actor: AuthenticatedUser,
    type: CmsContentType,
    itemId: CanonicalRow["id"],
  ) {
    this.assertTrashable(type);
    const item = await requireItem(this.prisma, type, itemId);
    if (!item.deletedAt)
      throw new ConflictException(
        "Move this to the Trash before deleting it permanently",
      );

    const references = await this.referencesTo(type, itemId);
    if (references.length)
      throw new ConflictException(
        `Still used by ${references.length} item${references.length === 1 ? "" : "s"}: ${references
          .slice(0, MAX_LISTED_REFERENCES)
          .join(
            ", ",
          )}${references.length > MAX_LISTED_REFERENCES ? "…" : ""}. Remove those references first.`,
      );

    await canonicalDelegate(this.prisma, type).delete({
      where: { id: itemId },
    });

    await this.auditService.log(actor, {
      action: AuditAction.CONTENT_DELETED,
      contentType: type,
      contentId: itemId,
      spaceId: item.spaceId,
    });
  }

  /** Everything trashed in a Space, newest first. */
  async list(spaceId: Space["id"]): Promise<TrashItemResponseDto[]> {
    const space = await this.context.requireSpace(spaceId);
    const defaultLanguage = space.site.defaultLanguage;

    const groups = await Promise.all(
      TRASHABLE.map(async (type) => {
        const kind = contentKind(type);
        const rows = (await kind.canonical(this.prisma).findMany({
          where: { spaceId, deletedAt: { not: null } },
          include: {
            locales: {
              select: { languageCode: true, [kind.titleField]: true },
            },
          },
        })) as (CanonicalRow &
          Record<string, unknown> & {
            locales: Record<string, unknown>[];
          })[];

        return rows.map((row) => ({
          type,
          id: row.id,
          title: contentTitle(
            type,
            row,
            row.locales.find(
              (locale) => locale.languageCode === defaultLanguage,
            ) ?? row.locales[0],
          ),
          deletedAt: row.deletedAt as NonNullable<Blog["deletedAt"]>,
        }));
      }),
    );

    return groups
      .flat()
      .sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());
  }

  /**
   * Trashing or restoring an item with a live language takes pages off the website or puts them
   * back, so the website is told — with the pages read now, while they are still findable.
   * Nothing is live: nothing to tell.
   */
  private async liveRefresh(
    type: CmsContentType,
    itemId: CanonicalRow["id"],
    spaceId: CanonicalRow["spaceId"],
  ) {
    const live = await localeDelegate(this.prisma, type).count({
      where: {
        [contentKind(type).localeForeignKey]: itemId,
        publishedRevision: { not: null },
      },
    });
    if (!live) return undefined;

    const space = await this.context.requireSpace(spaceId);
    const targets = await this.revalidate.targetsFor(
      type,
      itemId,
      null,
      space.site.defaultLanguage,
    );
    return (event: RevalidateEvent) =>
      this.revalidate.notify(space, { event, type, id: itemId, targets });
  }

  private assertTrashable(type: CmsContentType) {
    if (!(TRASHABLE as readonly CmsContentType[]).includes(type))
      throw new BadRequestException(
        `${CONTENT_TYPE_LABELS[type]} belongs to its Space and cannot be trashed`,
      );
  }

  /**
   * A trashed item is absent from the website, so trashing or restoring one with a live
   * language takes it off or puts it back — which is unpublishing and publishing, neither of which
   * a Writer may do. They may still trash and restore anything that is not live.
   */
  private async assertMayChangeWhatIsLive(
    actor: AuthenticatedUser,
    type: CmsContentType,
    itemId: CanonicalRow["id"],
  ) {
    if (actor.role !== CmsRole.WRITER) return;
    const live = await localeDelegate(this.prisma, type).count({
      where: {
        [contentKind(type).localeForeignKey]: itemId,
        publishedRevision: { not: null },
      },
    });
    if (live)
      throw new ForbiddenException(
        "This is live on the website, so taking it off or putting it back needs an Admin or Author",
      );
  }

  private async referencesTo(
    type: CmsContentType,
    itemId: CanonicalRow["id"],
  ): Promise<string[]> {
    const where =
      type === CmsContentType.AUTHOR
        ? { OR: [{ authorId: itemId }, { reviewerId: itemId }] }
        : type === CmsContentType.CATEGORY
          ? { categoryId: itemId }
          : type === CmsContentType.TAG
            ? { tags: { some: { tagId: itemId } } }
            : undefined;

    const [posts, bodies, live, featured] = await Promise.all([
      where
        ? this.prisma.blog.findMany({
            where,
            select: {
              deletedAt: true,
              locales: {
                select: { title: true },
                orderBy: { languageCode: "asc" },
                take: 1,
              },
            },
          })
        : [],
      blogBodiesContaining(this.prisma, itemId),
      liveBlogVersionsContaining(this.prisma, itemId),
      type === CmsContentType.BLOG
        ? featuredListsContaining(this.prisma, itemId)
        : [],
    ]);

    const label = (title: string | undefined, deletedAt: Date | null) =>
      `"${title ?? "Untitled post"}"${deletedAt ? " (in the Trash)" : ""}`;

    // A post that mentions itself is not blocking its own deletion
    const others = <T extends { blogId: string }>(rows: T[]) =>
      rows.filter((row) => row.blogId !== itemId);

    return [
      ...posts.map((post) => label(post.locales[0]?.title, post.deletedAt)),
      ...others(bodies).map(
        (body) => `${label(body.title, body.deletedAt)} body`,
      ),
      ...others(live).map(
        (version) =>
          `${label(version.title, version.deletedAt)} live in ${version.languageCode}`,
      ),
      ...featured.map(
        (list) => `the ${list.languageCode} Featured Articles list`,
      ),
    ];
  }
}
