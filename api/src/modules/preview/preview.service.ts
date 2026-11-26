import { randomBytes } from "node:crypto";
import type { CmsContentType, Site, SiteLanguage, Space } from "@loom/database";
import type {
  DeliveryPreviewTargetResponseDto,
  PreviewLinkResponseDto,
} from "@loom/dto";
import {
  CONTENT_TYPE_LABELS,
  isPreviewable,
  PREVIEW_LINK_TTL_MS,
  PREVIEWABLE_TYPES,
  type PreviewableContentType,
} from "@loom/dto/constants";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  canonicalDelegate,
  localeDelegate,
  requireItem,
  requireLocale,
} from "../content/content-item.util";
import { contentKind } from "../content/content-kind.registry";
import { PrismaService } from "../prisma/prisma.service";
import { readPreviewToken, signPreviewToken } from "./preview-token.util";

/**
 * Draft preview. The editor's Preview button gets a link from here: the Site's preview URL with a
 * short-lived token naming one item in one language. The website's preview route hands the token
 * back through the Content API (`resolve`) to learn what to show, turns on its draft mode, and from
 * then on reads with `preview=true`. The token never grants reading drafts by itself — that takes
 * an API key allowed to — so a leaked link is only as good as the website's own draft mode.
 */
@Injectable()
export class PreviewService {
  constructor(private readonly prisma: PrismaService) {}

  async createLink(
    type: CmsContentType,
    itemId: string,
    languageCode: SiteLanguage["code"],
  ): Promise<PreviewLinkResponseDto> {
    if (!isPreviewable(type))
      throw new BadRequestException(
        "Only posts, categories, tags and authors have pages of their own to preview",
      );

    const item = await requireItem(this.prisma, type, itemId);
    if (item.deletedAt)
      throw new ConflictException(
        `This ${CONTENT_TYPE_LABELS[type].toLowerCase()} is in the Trash, so there is nothing to preview`,
      );
    // Saved at least once in this language, or the website would have nothing to show
    await requireLocale(this.prisma, type, itemId, languageCode);

    const space = await this.prisma.space.findUniqueOrThrow({
      where: { id: item.spaceId },
      include: { site: { include: { languages: true } } },
    });
    const { site } = space;
    if (!site.previewUrl)
      throw new BadRequestException(
        `Set a preview URL for ${site.name} in Settings → Sites first`,
      );
    const language = site.languages.find(({ code }) => code === languageCode);
    if (!language?.enabled)
      throw new BadRequestException(
        `${languageCode} is not enabled on ${site.name}, so its website cannot show it`,
      );

    const expiresAt = new Date(Date.now() + PREVIEW_LINK_TTL_MS);
    const token = signPreviewToken(
      {
        v: 1,
        site: site.id,
        space: space.id,
        type,
        id: itemId,
        lang: languageCode,
        exp: expiresAt.getTime(),
      },
      await this.secretOf(site),
    );

    const url = new URL(site.previewUrl);
    url.searchParams.set("token", token);
    return { url: url.toString(), expiresAt };
  }

  /**
   * What a token points at, for the website it was issued to. `siteId` is the API key's Site, and
   * the token must have been signed with that Site's secret, so one Site's key cannot open another
   * Site's link.
   */
  async resolve(
    siteId: Site["id"],
    spaceSlug: Space["slug"],
    token: string,
  ): Promise<DeliveryPreviewTargetResponseDto> {
    const invalid = new UnauthorizedException("This preview link is not valid");

    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
      select: { previewSecret: true },
    });
    const claims = site?.previewSecret
      ? readPreviewToken(token, site.previewSecret)
      : null;
    if (!claims || claims.site !== siteId || !isPreviewable(claims.type))
      throw invalid;
    if (Date.now() > claims.exp)
      throw new UnauthorizedException(
        "This preview link has expired. Press Preview in Loom again",
      );

    const space = await this.prisma.space.findUnique({
      where: { id: claims.space },
      select: { slug: true },
    });
    if (!space)
      throw new NotFoundException(
        "The space this preview link was made in no longer exists",
      );
    if (space.slug !== spaceSlug)
      throw new BadRequestException(
        `This preview link is for the ${space.slug} space, not ${spaceSlug}`,
      );

    const item = await canonicalDelegate(this.prisma, claims.type).findUnique({
      where: { id: claims.id },
    });
    if (!item || item.deletedAt)
      throw new NotFoundException(
        "What this preview link points at has been deleted or moved to the Trash",
      );

    return {
      type: PREVIEWABLE_TYPES[claims.type],
      id: claims.id,
      languageCode: claims.lang,
      slug: await this.slugOf(claims.type, claims.id, claims.lang),
      expiresAt: new Date(claims.exp),
    };
  }

  /** The slug the website routes by, as saved now: per language for a post, shared otherwise. */
  private async slugOf(
    type: PreviewableContentType,
    itemId: string,
    languageCode: SiteLanguage["code"],
  ): Promise<string | null> {
    const kind = contentKind(type);
    if (kind.slugScope === "canonical") {
      const row = (await canonicalDelegate(this.prisma, type).findUnique({
        where: { id: itemId },
      })) as { slug?: string } | null;
      return row?.slug ?? null;
    }
    if (kind.slugScope === "locale") {
      const locale = (await localeDelegate(this.prisma, type).findFirst({
        where: { [kind.localeForeignKey]: itemId, languageCode },
      })) as { slug?: string } | null;
      if (!locale)
        throw new NotFoundException(
          `What this preview link points at has no ${languageCode} version any more`,
        );
      return locale.slug ?? null;
    }
    return null;
  }

  /**
   * The Site's signing secret, made the first time it is needed. Set only where none exists yet, so
   * two first links at once agree on one secret rather than the second invalidating the first.
   */
  private async secretOf(site: Pick<Site, "id" | "previewSecret">) {
    if (site.previewSecret) return site.previewSecret;
    await this.prisma.site.updateMany({
      where: { id: site.id, previewSecret: null },
      data: { previewSecret: randomBytes(32).toString("base64url") },
    });
    const { previewSecret } = await this.prisma.site.findUniqueOrThrow({
      where: { id: site.id },
      select: { previewSecret: true },
    });
    if (!previewSecret) throw new Error("The preview secret was not saved");
    return previewSecret;
  }
}
