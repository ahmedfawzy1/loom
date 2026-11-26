import {
  AuditAction,
  type Author,
  type Blog,
  type BlogLocale,
  type Category,
  CmsContentType,
  type Cta,
  type Prisma,
  type SiteLanguage,
  type Tag,
} from "@loom/database";
import type { BlockingReferenceResponseDto } from "@loom/dto";
import {
  BLOG_SUMMARY_MAX_LENGTH,
  BLOG_SUMMARY_MIN_LENGTH,
  CONTENT_TYPE_LABELS,
  type RichTextEntryType,
} from "@loom/dto/constants";
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import { ContentContextService } from "../content/content-context.service";
import {
  assertNotTrashed,
  type CanonicalRow,
  canonicalDelegate,
  type LocaleRow,
  localeDelegate,
  requireItem,
  requireLocale,
  versionDelegate,
} from "../content/content-item.util";
import { contentKind } from "../content/content-kind.registry";
import { contentTitle } from "../content/content-title.util";
import { liveCanonical } from "../content/live-canonical.util";
import {
  collectReferences,
  type RichTextNode,
} from "../content/rich-text.util";
import type {
  BlogSnapshot,
  FeaturedArticlesSnapshot,
} from "../content/snapshot.util";
import { VersionService } from "../content/version.service";
import {
  approve,
  type LocaleStateUpdate,
  publish,
  requestChanges,
  submit,
  unpublish,
} from "../content/workflow.util";
import { PrismaService } from "../prisma/prisma.service";
import {
  type RevalidateEvent,
  RevalidateService,
} from "../revalidate/revalidate.service";

type Tx = Prisma.TransactionClient;

/** The records a version going live points at, by kind. */
interface LiveReferences {
  authors?: (Author["id"] | null)[];
  categories?: (Category["id"] | null)[];
  tags?: Tag["id"][];
  ctas?: Cta["id"][];
  blogs?: Blog["id"][];
}

// What each field of LiveReferences names
const REFERENCE_TYPES: [keyof LiveReferences, CmsContentType][] = [
  ["authors", CmsContentType.AUTHOR],
  ["categories", CmsContentType.CATEGORY],
  ["tags", CmsContentType.TAG],
  ["ctas", CmsContentType.CTA],
  ["blogs", CmsContentType.BLOG],
];

/**
 * What a version refers to that the website could not serve with it: gone, in the Trash, or not
 * published in any of `languages` — the ones the Content API would look in. An unpublished one
 * names the first of `languages` it has a version in, where publishing it would clear the way.
 */
async function findBlockers(
  tx: Tx,
  references: LiveReferences,
  languages: SiteLanguage["code"][],
  defaultLanguage: SiteLanguage["code"],
): Promise<BlockingReferenceResponseDto[]> {
  const blockers: BlockingReferenceResponseDto[] = [];
  for (const [field, type] of REFERENCE_TYPES) {
    const wanted = [
      ...new Set(
        (references[field] ?? []).filter((id): id is string => Boolean(id)),
      ),
    ];
    if (!wanted.length) continue;

    const kind = contentKind(type);
    const [items, locales] = await Promise.all([
      canonicalDelegate(tx, type).findMany({ where: { id: { in: wanted } } }),
      localeDelegate(tx, type).findMany({
        where: { [kind.localeForeignKey]: { in: wanted } },
      }),
    ]);
    for (const id of wanted) {
      const item = items.find((candidate) => candidate.id === id);
      const own = (locales as (LocaleRow & Record<string, unknown>)[]).filter(
        (locale) => locale[kind.localeForeignKey] === id,
      );
      const title = item
        ? contentTitle(
            type,
            item as unknown as Record<string, unknown>,
            own.find((locale) => locale.languageCode === defaultLanguage) ??
              own[0],
          )
        : id;
      if (!item)
        blockers.push({
          type,
          id,
          title,
          reason: "missing",
          publishIn: null,
          status: null,
        });
      else if (item.deletedAt)
        blockers.push({
          type,
          id,
          title,
          reason: "trashed",
          publishIn: null,
          status: null,
        });
      else if (
        !own.some(
          (locale) =>
            languages.includes(locale.languageCode) &&
            locale.publishedRevision !== null,
        )
      ) {
        const publishable = languages
          .map((language) =>
            own.find((locale) => locale.languageCode === language),
          )
          .find(Boolean);
        blockers.push({
          type,
          id,
          title,
          reason: "unpublished",
          publishIn: publishable?.languageCode ?? null,
          status: publishable?.status ?? null,
        });
      }
    }
  }
  return blockers;
}

const BLOCKER_PROBLEMS: Record<
  BlockingReferenceResponseDto["reason"],
  (languages: SiteLanguage["code"][]) => string
> = {
  missing: () => "which no longer exists — remove it",
  trashed: () => "which is in the Trash — restore or remove it",
  unpublished: (languages) =>
    `which is not published in ${languages.join(" or ")} — publish or remove it`,
};

/**
 * Refuses a version the website could not serve whole. Otherwise the post goes live with no byline,
 * no category, or an embed that renders as nothing. A save grandfathers such references;
 * publishing is where what readers get is decided.
 */
async function assertReferencesServable(
  tx: Tx,
  references: LiveReferences,
  languages: SiteLanguage["code"][],
  defaultLanguage: SiteLanguage["code"],
) {
  const blockers = await findBlockers(
    tx,
    references,
    languages,
    defaultLanguage,
  );
  if (blockers.length)
    throw new BadRequestException(
      `This version refers to ${blockers
        .map(
          (blocker) =>
            `${CONTENT_TYPE_LABELS[blocker.type]} “${blocker.title}”, ${BLOCKER_PROBLEMS[blocker.reason](languages)}`,
        )
        .join("; ")}. A removal needs a save before publishing again`,
    );
}

/**
 * What the version going live must satisfy, beyond what a save already checked: the Blog summary,
 * which cannot be a save rule because a post is created before it is written, and live
 * references for the types that have them.
 */
/** Which locale is going live, so a gate can check what will actually be served with it. */
interface GateContext {
  itemId: CanonicalRow["id"];
  spaceId: CanonicalRow["spaceId"];
  languageCode: SiteLanguage["code"];
  defaultLanguage: SiteLanguage["code"];
}

/** What a version going live refers to, and the languages each reference may be live in. */
const REFERENCES_OF: Partial<
  Record<
    CmsContentType,
    (
      tx: Tx,
      snapshot: object,
      context: GateContext,
    ) => Promise<{
      references: LiveReferences;
      languages: SiteLanguage["code"][];
    }>
  >
> = {
  [CmsContentType.BLOG]: async (tx, snapshot, context) => {
    const post = snapshot as BlogSnapshot;
    // The shared fields served with this language, which for a translation are the default
    // language's — not this version's own copy, which nobody will see
    const shared = await liveCanonical(
      tx,
      CmsContentType.BLOG,
      context.itemId,
      context.languageCode,
      context.defaultLanguage,
      post,
    );
    const body = collectReferences(post.body as unknown as RichTextNode);
    const entries = (type: RichTextEntryType) =>
      body.entries
        .filter((entry) => entry.type === type)
        .map((entry) => entry.id);
    return {
      references: {
        authors: [shared.authorId, shared.reviewerId, ...entries("author")],
        categories: [shared.categoryId, ...entries("category")],
        tags: [...shared.tagIds, ...entries("tag")],
        // Links to other posts are left out on purpose: two posts that link to each other could
        // otherwise never go live, and a link to a post that is not live renders as its plain text
        ctas: [...body.ctaIds],
      },
      // References fall back to the default language on the website, so either will do
      languages: [...new Set([context.languageCode, context.defaultLanguage])],
    };
  },
  // A featured list shows only posts live in its own language, so a fallback does not count
  [CmsContentType.FEATURED_ARTICLES]: async (_tx, snapshot, context) => ({
    references: { blogs: (snapshot as FeaturedArticlesSnapshot).items },
    languages: [context.languageCode],
  }),
};

async function assertGateReferences(
  tx: Tx,
  type: CmsContentType,
  snapshot: object,
  context: GateContext,
) {
  const found = await REFERENCES_OF[type]?.(tx, snapshot, context);
  if (found)
    await assertReferencesServable(
      tx,
      found.references,
      found.languages,
      context.defaultLanguage,
    );
}

const PUBLISH_GATES: Partial<
  Record<
    CmsContentType,
    (tx: Tx, snapshot: object, context: GateContext) => Promise<void>
  >
> = {
  [CmsContentType.BLOG]: async (tx, snapshot, context) => {
    const post = snapshot as BlogSnapshot;
    const length = post.summary?.length ?? 0;
    if (length < BLOG_SUMMARY_MIN_LENGTH || length > BLOG_SUMMARY_MAX_LENGTH)
      throw new BadRequestException(
        `A post needs a summary of ${BLOG_SUMMARY_MIN_LENGTH}–${BLOG_SUMMARY_MAX_LENGTH} characters before it can be published — this one has ${length}`,
      );

    // Saves check working slugs only, and a live post can have moved its working slug on — so two
    // posts could otherwise be live at one address, one of them never reachable
    const [holder] = await tx.$queryRaw<{ title: string }[]>`
      SELECT v."snapshot"->>'title' AS "title"
      FROM "BlogLocale" l
      JOIN "Blog" b ON b."id" = l."blogId" AND b."deletedAt" IS NULL
      JOIN "BlogVersion" v ON v."blogLocaleId" = l."id" AND v."revision" = l."publishedRevision"
      WHERE l."spaceId" = ${context.spaceId} AND l."languageCode" = ${context.languageCode}
        AND l."blogId" <> ${context.itemId} AND v."snapshot"->>'slug' = ${post.slug}
      LIMIT 1
    `;
    if (holder)
      throw new ConflictException(
        `“${holder.title}” is already live at ${post.slug} in ${context.languageCode} — give this post another slug, save, then publish`,
      );

    await assertGateReferences(tx, CmsContentType.BLOG, post, context);
  },
  [CmsContentType.FEATURED_ARTICLES]: (tx, snapshot, context) =>
    assertGateReferences(
      tx,
      CmsContentType.FEATURED_ARTICLES,
      snapshot,
      context,
    ),
};

/** One transition: which rule computes it, what it is logged as, and whether it puts content live. */
interface Transition {
  step: (locale: LocaleRow, now: Date) => LocaleStateUpdate;
  action: AuditAction;
  goesLive?: boolean;
  /** Set when the transition changes what the website serves, so it is told to refresh. */
  revalidate?: RevalidateEvent;
  metadata?: Prisma.InputJsonObject;
}

/** Publish and review, per locale. Role checks are the controller's guards. */
@Injectable()
export class PublishService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly versions: VersionService,
    private readonly context: ContentContextService,
    private readonly revalidate: RevalidateService,
  ) {}

  submit(
    actor: AuthenticatedUser,
    type: CmsContentType,
    itemId: CanonicalRow["id"],
    languageCode: SiteLanguage["code"],
  ) {
    return this.apply(actor, type, itemId, languageCode, {
      step: (locale, now) => submit(locale, actor.id, now),
      action: AuditAction.CONTENT_SUBMITTED,
    });
  }

  approve(
    actor: AuthenticatedUser,
    type: CmsContentType,
    itemId: CanonicalRow["id"],
    languageCode: SiteLanguage["code"],
  ) {
    return this.apply(actor, type, itemId, languageCode, {
      step: (locale, now) => approve(locale, actor.id, now),
      action: AuditAction.CONTENT_APPROVED,
      goesLive: true,
      revalidate: "publish",
    });
  }

  requestChanges(
    actor: AuthenticatedUser,
    type: CmsContentType,
    itemId: CanonicalRow["id"],
    languageCode: SiteLanguage["code"],
    note: NonNullable<BlogLocale["reviewNote"]>,
  ) {
    return this.apply(actor, type, itemId, languageCode, {
      step: (locale, now) => requestChanges(locale, actor.id, note.trim(), now),
      action: AuditAction.CONTENT_CHANGES_REQUESTED,
      metadata: { note: note.trim() },
    });
  }

  publish(
    actor: AuthenticatedUser,
    type: CmsContentType,
    itemId: CanonicalRow["id"],
    languageCode: SiteLanguage["code"],
  ) {
    return this.apply(actor, type, itemId, languageCode, {
      step: (locale, now) => publish(locale, actor.id, now),
      action: AuditAction.CONTENT_PUBLISHED,
      goesLive: true,
      revalidate: "publish",
    });
  }

  unpublish(
    actor: AuthenticatedUser,
    type: CmsContentType,
    itemId: CanonicalRow["id"],
    languageCode: SiteLanguage["code"],
  ) {
    return this.apply(actor, type, itemId, languageCode, {
      step: (locale) => unpublish(locale),
      action: AuditAction.CONTENT_UNPUBLISHED,
      revalidate: "unpublish",
    });
  }

  /**
   * What stands between this language's latest version and going live — so the editor can offer to
   * publish those first rather than only refuse. The publish gate checks the same thing again.
   */
  async blockingReferences(
    type: CmsContentType,
    itemId: CanonicalRow["id"],
    languageCode: SiteLanguage["code"],
  ): Promise<BlockingReferenceResponseDto[]> {
    const referencesOf = REFERENCES_OF[type];
    if (!referencesOf) return [];
    const item = await requireItem(this.prisma, type, itemId);
    const space = await this.context.requireSpace(item.spaceId);
    const locale = await requireLocale(this.prisma, type, itemId, languageCode);
    const version = await versionDelegate(this.prisma, type).findFirst({
      where: {
        [contentKind(type).versionForeignKey]: locale.id,
        revision: locale.revision,
      },
    });
    // Unrecorded rows predate versioning; publishing records them and gates them then
    if (!version) return [];

    const context = {
      itemId,
      spaceId: item.spaceId,
      languageCode,
      defaultLanguage: space.site.defaultLanguage,
    };
    const { references, languages } = await referencesOf(
      this.prisma,
      version.snapshot as object,
      context,
    );
    return findBlockers(
      this.prisma,
      references,
      languages,
      context.defaultLanguage,
    );
  }

  private async apply(
    actor: AuthenticatedUser,
    type: CmsContentType,
    itemId: CanonicalRow["id"],
    languageCode: SiteLanguage["code"],
    transition: Transition,
  ): Promise<LocaleRow> {
    const item = await requireItem(this.prisma, type, itemId);
    assertNotTrashed(item, type);
    const space = await this.context.requireSpace(item.spaceId);
    const locale = await requireLocale(this.prisma, type, itemId, languageCode);
    const update = transition.step(locale, new Date());
    // Read before the change: an unpublish leaves no live slug to find afterwards
    const targets = transition.revalidate
      ? await this.revalidate.targetsFor(
          type,
          itemId,
          languageCode,
          space.site.defaultLanguage,
        )
      : null;

    await this.prisma.$transaction(async (tx) => {
      if (transition.goesLive) {
        // `publishedRevision` must always name a version; rows saved before versioning have none
        await this.versions.ensureRecorded(
          tx,
          type,
          locale.id,
          locale.revision,
          actor.id,
        );
        const going = await versionDelegate(tx, type).findFirst({
          where: {
            [contentKind(type).versionForeignKey]: locale.id,
            revision: locale.revision,
          },
        });
        if (going)
          await PUBLISH_GATES[type]?.(tx, going.snapshot as object, {
            itemId,
            spaceId: item.spaceId,
            languageCode,
            defaultLanguage: space.site.defaultLanguage,
          });
      }

      // Only if nothing moved since the step was computed: a save in between would otherwise leave
      // this marked Published at a revision older than the one now in the editor
      const { count } = await localeDelegate(tx, type).updateMany({
        where: {
          id: locale.id,
          revision: locale.revision,
          status: locale.status,
          // …or a trash landed after the check above
          [contentKind(type).canonicalRelation]: { deletedAt: null },
        },
        data: update,
      });
      if (count !== 1)
        throw new ConflictException(
          "This language changed while you were working on it — reload and try again",
        );
    });

    await this.auditService.log(actor, {
      action: transition.action,
      contentType: type,
      contentId: itemId,
      languageCode,
      spaceId: item.spaceId,
      metadata: { revision: locale.revision, ...transition.metadata },
    });

    if (transition.revalidate)
      this.revalidate.notify(space, {
        event: transition.revalidate,
        type,
        id: itemId,
        targets,
      });

    return requireLocale(this.prisma, type, itemId, languageCode);
  }
}
