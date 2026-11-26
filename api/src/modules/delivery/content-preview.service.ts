import type { CmsContentType, SiteLanguage } from "@loom/database";
import type { ContentPreviewResponseDto } from "@loom/dto";
import {
  CONTENT_TYPE_LABELS,
  isPreviewable,
  PREVIEWABLE_TYPES,
} from "@loom/dto/constants";
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import { localeDelegate, requireItem } from "../content/content-item.util";
import { contentKind } from "../content/content-kind.registry";
import { PrismaService } from "../prisma/prisma.service";
import { DeliveryService } from "./delivery.service";

/** How many posts a category, tag or author preview lists, like the first page of its own page. */
const PREVIEW_POSTS = 12;

/**
 * The admin's built-in preview: one item in one language as a website would receive it in draft
 * mode, through the Content API's own code (DeliveryService with `preview`), so nothing here can
 * drift from what websites get. No website or API key is involved — the editor sees it in Loom.
 */
@Injectable()
export class ContentPreviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly delivery: DeliveryService,
  ) {}

  async preview(
    type: CmsContentType,
    id: string,
    languageCode: SiteLanguage["code"],
  ): Promise<ContentPreviewResponseDto> {
    if (!isPreviewable(type))
      throw new BadRequestException(
        "Only posts, categories, tags and authors have pages of their own to preview",
      );

    const item = await requireItem(this.prisma, type, id);
    if (item.deletedAt)
      throw new ConflictException(
        `This ${CONTENT_TYPE_LABELS[type].toLowerCase()} is in the Trash, so there is nothing to preview`,
      );

    const kind = contentKind(type);
    const [locales, space] = await Promise.all([
      localeDelegate(this.prisma, type).findMany({
        where: { [kind.localeForeignKey]: id },
      }),
      this.prisma.space.findUniqueOrThrow({
        where: { id: item.spaceId },
        include: { site: { include: { languages: true } } },
      }),
    ]);
    const { site } = space;

    // The languages a website could be asked for, in the Site's own order
    const enabled = site.languages
      .filter((language) => language.enabled)
      .sort((a, b) => a.position - b.position);
    const saved = enabled.flatMap((language) =>
      locales
        .filter((locale) => locale.languageCode === language.code)
        .map((locale) => ({
          languageCode: locale.languageCode,
          nativeName: language.nativeName,
          status: locale.status,
          isLive: locale.publishedRevision != null,
        })),
    );

    const requested = site.languages.find(
      (language) => language.code === languageCode,
    );
    const base: ContentPreviewResponseDto = {
      type: PREVIEWABLE_TYPES[type],
      id,
      languageCode,
      languageName: requested?.nativeName ?? languageCode,
      rtl: requested?.rtl ?? false,
      siteName: site.name,
      siteDomain: site.domain,
      hasWebsitePreview: Boolean(site.previewUrl),
      locales: saved,
      blog: null,
      category: null,
      tag: null,
      author: null,
      posts: [],
    };
    // Nothing written in this language yet — the page says so and offers the others
    if (!saved.some((locale) => locale.languageCode === languageCode))
      return base;

    const scope = await this.delivery.scopeForSpace(
      item.spaceId,
      languageCode,
      true,
    );
    switch (type) {
      case "BLOG":
        return { ...base, blog: await this.delivery.getBlogById(scope, id) };
      case "CATEGORY": {
        const [category, posts] = await Promise.all([
          this.delivery.getCategoryById(scope, id),
          this.delivery.postsWhere(scope, { categoryId: id }, PREVIEW_POSTS),
        ]);
        return { ...base, category, posts };
      }
      case "TAG": {
        const [tag, posts] = await Promise.all([
          this.delivery.getTagById(scope, id),
          this.delivery.postsWhere(scope, { tagId: id }, PREVIEW_POSTS),
        ]);
        return { ...base, tag, posts };
      }
      case "AUTHOR": {
        const [author, posts] = await Promise.all([
          this.delivery.getAuthor(scope, id),
          this.delivery.postsWhere(scope, { authorId: id }, PREVIEW_POSTS),
        ]);
        return { ...base, author, posts };
      }
    }
  }
}
