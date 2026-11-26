import type { LocaleStatus, SiteLanguage } from "@loom/database";
import { Expose, Type } from "class-transformer";
import type { PreviewableType } from "../../constants/preview.constants";
import { DeliveryAuthorResponseDto } from "../delivery/delivery-author-response.dto";
import { DeliveryBlogResponseDto } from "../delivery/delivery-blog-response.dto";
import { DeliveryBlogSummaryResponseDto } from "../delivery/delivery-blog-summary-response.dto";
import { DeliveryCategoryDetailResponseDto } from "../delivery/delivery-category-detail-response.dto";
import { DeliveryTagDetailResponseDto } from "../delivery/delivery-tag-detail-response.dto";

/** A language the item has been saved in, and where it stands there. */
export class ContentPreviewLocaleResponseDto {
  @Expose()
  languageCode: SiteLanguage["code"];

  /** The language's own name for itself, for the language switcher. */
  @Expose()
  nativeName: SiteLanguage["nativeName"];

  @Expose()
  status: LocaleStatus;

  /** Whether some version of it is on the website now — what a Changed or In review one replaces. */
  @Expose()
  isLive: boolean;
}

/**
 * The admin's own preview of one item in one language: the latest saved version, shaped exactly as
 * the Content API would serve it with `preview=true`, so what the page shows is what a website gets.
 * One of `blog`, `category`, `tag` or `author` is set, matching `type`, unless the item has no
 * version in this language yet, when all four are null.
 */
export class ContentPreviewResponseDto {
  @Expose()
  type: PreviewableType;

  @Expose()
  id: string;

  @Expose()
  languageCode: SiteLanguage["code"];

  /** The language's own name, whether or not the item has been written in it yet. */
  @Expose()
  languageName: SiteLanguage["nativeName"];

  /** Whether the language reads right to left, so the page lays the content out that way. */
  @Expose()
  rtl: boolean;

  @Expose()
  siteName: string;

  /** For turning a CTA's relative /path into the address readers would go to. */
  @Expose()
  siteDomain: string;

  /** Whether the Site has a preview URL, so the page can also offer to open the real website. */
  @Expose()
  hasWebsitePreview: boolean;

  /** The enabled languages the item has been saved in, in the Site's order. */
  @Expose()
  @Type(() => ContentPreviewLocaleResponseDto)
  locales: ContentPreviewLocaleResponseDto[];

  @Expose()
  @Type(() => DeliveryBlogResponseDto)
  blog: DeliveryBlogResponseDto | null;

  @Expose()
  @Type(() => DeliveryCategoryDetailResponseDto)
  category: DeliveryCategoryDetailResponseDto | null;

  @Expose()
  @Type(() => DeliveryTagDetailResponseDto)
  tag: DeliveryTagDetailResponseDto | null;

  @Expose()
  @Type(() => DeliveryAuthorResponseDto)
  author: DeliveryAuthorResponseDto | null;

  /** For a category, tag or author: the posts its page would list, newest first. */
  @Expose()
  @Type(() => DeliveryBlogSummaryResponseDto)
  posts: DeliveryBlogSummaryResponseDto[];
}
