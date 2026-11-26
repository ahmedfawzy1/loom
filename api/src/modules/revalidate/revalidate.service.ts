import { AsyncLocalStorage } from "node:async_hooks";
import {
  AuditAction,
  CmsContentType,
  type Media,
  type Site,
  type SiteLanguage,
  type Space,
} from "@loom/database";
import { CONTENT_TYPE_PATHS } from "@loom/dto/constants";
import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
} from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import { ContentContextService } from "../content/content-context.service";
import type { CanonicalRow } from "../content/content-item.util";
import { PrismaService } from "../prisma/prisma.service";
import { REVALIDATE_TIMEOUT_MS } from "./revalidate.constants";

/** A page the website serves a post at: the language and the slug it is live under. */
export interface RevalidateTarget {
  locale: SiteLanguage["code"];
  slug: string;
}

export type RevalidateEvent =
  | "publish"
  | "unpublish"
  | "trash"
  | "restore"
  | "media"
  | "settings"
  | "bulk";

interface RevalidateSpace {
  slug: Space["slug"];
  site: Pick<Site, "slug" | "revalidateUrl" | "revalidateSecret">;
}

/** Where to send a refresh, if the Site has been told. */
const endpointOf = ({ site, slug }: RevalidateSpace) =>
  site.revalidateUrl && site.revalidateSecret
    ? {
        url: site.revalidateUrl,
        secret: site.revalidateSecret,
        site: site.slug,
        space: slug,
      }
    : undefined;

type Endpoint = NonNullable<ReturnType<typeof endpointOf>>;

/** What a batch has to send to one Space: every page it touched, or everything. */
interface Batched {
  space: RevalidateSpace;
  all: boolean;
  targets: Map<string, RevalidateTarget>;
}

/**
 * Tells the website what changed so it drops its cached pages. The body is the contract the
 * website's `/api/contentful-revalidate` route already takes — `targets` for the posts whose pages
 * changed, `all` for everything else, since a category, tag, author or CTA shows on many pages — plus
 * what changed, for a route that wants to be more precise. The secret goes in the `secret` header,
 * as that route expects.
 */
@Injectable()
export class RevalidateService {
  private readonly logger = new Logger(RevalidateService.name);
  private readonly batches = new AsyncLocalStorage<Map<string, Batched>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly context: ContentContextService,
  ) {}

  /**
   * The post pages a change to one language touches, read before the change: the slug going live
   * and the one that was live. A default-language change moves the shared fields every language is
   * served, so every live language's page is included. Null for other types: all pages.
   */
  async targetsFor(
    type: CmsContentType,
    itemId: CanonicalRow["id"],
    languageCode: SiteLanguage["code"] | null,
    defaultLanguage: SiteLanguage["code"],
  ): Promise<RevalidateTarget[] | null> {
    if (type !== CmsContentType.BLOG) return null;

    const locales = await this.prisma.blogLocale.findMany({
      where: { blogId: itemId },
      select: {
        id: true,
        languageCode: true,
        slug: true,
        publishedRevision: true,
      },
    });
    const affected = locales.filter(
      (locale) =>
        languageCode === null ||
        languageCode === defaultLanguage ||
        locale.languageCode === languageCode,
    );
    const live = affected.flatMap((locale) =>
      locale.publishedRevision === null
        ? []
        : [{ blogLocaleId: locale.id, revision: locale.publishedRevision }],
    );
    const versions = live.length
      ? await this.prisma.blogVersion.findMany({
          where: { OR: live },
          select: { blogLocaleId: true, snapshot: true },
        })
      : [];

    const targets = new Map<string, RevalidateTarget>();
    const add = (locale: SiteLanguage["code"], slug: unknown) => {
      if (typeof slug === "string")
        targets.set(`${locale} ${slug}`, { locale, slug });
    };
    for (const locale of affected) {
      if (locale.languageCode === languageCode)
        add(locale.languageCode, locale.slug);
      const version = versions.find((v) => v.blogLocaleId === locale.id);
      add(
        locale.languageCode,
        (version?.snapshot as { slug?: unknown } | null)?.slug,
      );
    }
    return [...targets.values()];
  }

  /**
   * After a change to what is live. It never holds up or fails the change itself: a website that
   * is down is logged, and the pages catch up on their own revalidate interval or a manual refresh.
   */
  notify(
    space: RevalidateSpace,
    change: {
      event: RevalidateEvent;
      type: CmsContentType;
      id: CanonicalRow["id"];
      targets: RevalidateTarget[] | null;
    },
  ): void {
    this.sendQuietly(space, change.event, {
      type: CONTENT_TYPE_PATHS[change.type],
      id: change.id,
      ...(change.targets ? { targets: change.targets } : { all: true }),
    });
  }

  /**
   * An image changed in the library — alt text, a replaced file, a delete or restore. Media is not
   * versioned, so the change is live at once wherever a live version shows the image: those
   * Spaces get a full refresh, and no other Space is bothered.
   */
  mediaChanged(mediaId: Media["id"]): void {
    this.spacesShowing(mediaId)
      .then((spaces) => {
        for (const space of spaces)
          this.sendQuietly(space, "media", { all: true });
      })
      .catch((error: unknown) => this.logger.warn(String(error)));
  }

  /** A Site setting that changes every page: its languages, or its default language. */
  siteChanged(siteId: Site["id"]): void {
    this.prisma.space
      .findMany({ where: { siteId }, include: { site: true } })
      .then((spaces) => {
        for (const space of spaces)
          this.sendQuietly(space, "settings", { all: true });
      })
      .catch((error: unknown) => this.logger.warn(String(error)));
  }

  /**
   * Runs `work` — a bulk action — sending one refresh per Space when it ends instead of one per
   * item, with every page it touched, or everything if anything asked for that. Sent even if part
   * of the work failed, for the part that did not.
   */
  async batch<T>(work: () => Promise<T>): Promise<T> {
    const collected = new Map<string, Batched>();
    try {
      return await this.batches.run(collected, work);
    } finally {
      for (const { space, all, targets } of collected.values())
        this.dispatch(
          space,
          "bulk",
          all ? { all: true } : { targets: [...targets.values()] },
        );
    }
  }

  /** The global "Refresh live pages" action: every page of the Space's website. */
  async refresh(actor: AuthenticatedUser, spaceId: Space["id"]): Promise<void> {
    const space = await this.context.requireSpace(spaceId);
    const endpoint = endpointOf(space);
    if (!endpoint)
      throw new BadRequestException(
        `Set ${space.site.name}'s refresh URL and secret in Settings → Sites first`,
      );

    await this.send(endpoint, { event: "refresh", all: true });

    await this.auditService.log(actor, {
      action: AuditAction.PAGES_REFRESHED,
      spaceId,
    });
  }

  /**
   * The Spaces where a live version of anything shows this image, as a shared field or in a body.
   * Matching the id as a JSON string in the snapshot text is exact, since ids are cuids.
   */
  private async spacesShowing(mediaId: Media["id"]) {
    const pattern = `%"${mediaId}"%`;
    const rows = await this.prisma.$queryRaw<{ spaceId: Space["id"] }[]>`
      SELECT DISTINCT l."spaceId" FROM "BlogLocale" l
        JOIN "BlogVersion" v ON v."blogLocaleId" = l."id" AND v."revision" = l."publishedRevision"
        WHERE v."snapshot"::text LIKE ${pattern}
      UNION
      SELECT l."spaceId" FROM "CategoryLocale" l
        JOIN "CategoryVersion" v ON v."categoryLocaleId" = l."id" AND v."revision" = l."publishedRevision"
        WHERE v."snapshot"::text LIKE ${pattern}
      UNION
      SELECT l."spaceId" FROM "TagLocale" l
        JOIN "TagVersion" v ON v."tagLocaleId" = l."id" AND v."revision" = l."publishedRevision"
        WHERE v."snapshot"::text LIKE ${pattern}
      UNION
      SELECT l."spaceId" FROM "AuthorLocale" l
        JOIN "AuthorVersion" v ON v."authorLocaleId" = l."id" AND v."revision" = l."publishedRevision"
        WHERE v."snapshot"::text LIKE ${pattern}
      UNION
      SELECT l."spaceId" FROM "CtaLocale" l
        JOIN "CtaVersion" v ON v."ctaLocaleId" = l."id" AND v."revision" = l."publishedRevision"
        WHERE v."snapshot"::text LIKE ${pattern}
    `;
    if (!rows.length) return [];
    return this.prisma.space.findMany({
      where: { id: { in: rows.map((row) => row.spaceId) } },
      include: { site: true },
    });
  }

  /**
   * Sends now, or adds to the batch this runs inside. Never throws: a website that is down is
   * logged, and catches up on its own interval.
   */
  private sendQuietly(
    space: RevalidateSpace,
    event: RevalidateEvent,
    body: { targets?: RevalidateTarget[]; all?: boolean } & Record<
      string,
      unknown
    >,
  ) {
    const batch = this.batches.getStore();
    if (!batch) return this.dispatch(space, event, body);

    const key = `${space.site.slug}/${space.slug}`;
    const entry = batch.get(key) ?? { space, all: false, targets: new Map() };
    if (body.all || !body.targets) entry.all = true;
    for (const target of body.targets ?? [])
      entry.targets.set(`${target.locale} ${target.slug}`, target);
    batch.set(key, entry);
  }

  private dispatch(
    space: RevalidateSpace,
    event: RevalidateEvent,
    body: Record<string, unknown>,
  ) {
    const endpoint = endpointOf(space);
    if (!endpoint) return;
    this.send(endpoint, { event, ...body }).catch((error: unknown) =>
      this.logger.warn(
        `Could not tell ${endpoint.site} to refresh after a ${event}: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
  }

  private async send(endpoint: Endpoint, body: Record<string, unknown>) {
    let response: Response;
    try {
      response = await fetch(endpoint.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          secret: endpoint.secret,
        },
        body: JSON.stringify({
          site: endpoint.site,
          space: endpoint.space,
          ...body,
        }),
        signal: AbortSignal.timeout(REVALIDATE_TIMEOUT_MS),
      });
    } catch (error) {
      throw new BadGatewayException(
        `The website could not be reached: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    // The status only: echoing the body would let the URL setting read back whatever it points at
    if (!response.ok)
      throw new BadGatewayException(
        `The website refused the refresh (${response.status})`,
      );
  }
}
