import type { Author, Category, Site, Space, Tag } from "@loom/database";
import {
  DeliveryAuthorResponseDto,
  DeliveryBlogListRequestDto,
  DeliveryBlogListResponseDto,
  DeliveryBlogResponseDto,
  DeliveryCategoryDetailResponseDto,
  DeliveryCategoryResponseDto,
  DeliveryFeaturedArticlesResponseDto,
  DeliveryLocaleRequestDto,
  DeliveryPreviewRequestDto,
  DeliveryPreviewTargetResponseDto,
  DeliveryTagDetailResponseDto,
  DeliveryTagResponseDto,
} from "@loom/dto";
import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  Query,
  Req,
  SerializeOptions,
  UseGuards,
} from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import type { Request } from "express";
import { ApiKeyGuard } from "../api-key/api-key.guard";
import { Public } from "../auth/public.decorator";
import { PreviewService } from "../preview/preview.service";
import { DeliveryService } from "./delivery.service";

/**
 * The Content API the websites call server-side. Public to the session guard, so its own: an
 * API key per Site. Order matters — the throttler counts by the key that
 * ApiKeyGuard found, at that key's own limit (delivery.module.ts). A request without a valid key
 * is refused from memory before it reaches the database.
 *
 * Every read takes `preview=true` to serve the latest saved versions instead of the published
 * ones, for a key allowed to read drafts; `preview` resolves the token a Preview link carried.
 */
@Public()
@UseGuards(ApiKeyGuard, ThrottlerGuard)
@Controller("content/:site/:space")
export class DeliveryController {
  constructor(
    private readonly deliveryService: DeliveryService,
    private readonly previewService: PreviewService,
  ) {}

  @SerializeOptions({ type: DeliveryBlogListResponseDto })
  @Get("blogs")
  async listBlogs(
    @Req() request: Request,
    @Param("site") site: Site["slug"],
    @Param("space") space: Space["slug"],
    @Query() query: DeliveryBlogListRequestDto,
  ): Promise<DeliveryBlogListResponseDto> {
    const scope = await this.scope(request, site, space, query);
    return this.deliveryService.listBlogs(scope, query);
  }

  @SerializeOptions({ type: DeliveryBlogResponseDto })
  @Get("blogs/:slug")
  async getBlog(
    @Req() request: Request,
    @Param("site") site: Site["slug"],
    @Param("space") space: Space["slug"],
    @Param("slug") slug: string,
    @Query() query: DeliveryLocaleRequestDto,
  ): Promise<DeliveryBlogResponseDto> {
    const scope = await this.scope(request, site, space, query);
    return this.deliveryService.getBlog(scope, slug);
  }

  @SerializeOptions({ type: DeliveryCategoryResponseDto })
  @Get("categories")
  async listCategories(
    @Req() request: Request,
    @Param("site") site: Site["slug"],
    @Param("space") space: Space["slug"],
    @Query() query: DeliveryLocaleRequestDto,
  ): Promise<DeliveryCategoryResponseDto[]> {
    const scope = await this.scope(request, site, space, query);
    return this.deliveryService.listCategories(scope);
  }

  @SerializeOptions({ type: DeliveryCategoryDetailResponseDto })
  @Get("categories/:slug")
  async getCategory(
    @Req() request: Request,
    @Param("site") site: Site["slug"],
    @Param("space") space: Space["slug"],
    @Param("slug") slug: Category["slug"],
    @Query() query: DeliveryLocaleRequestDto,
  ): Promise<DeliveryCategoryDetailResponseDto> {
    const scope = await this.scope(request, site, space, query);
    return this.deliveryService.getCategory(scope, slug);
  }

  @SerializeOptions({ type: DeliveryTagResponseDto })
  @Get("tags")
  async listTags(
    @Req() request: Request,
    @Param("site") site: Site["slug"],
    @Param("space") space: Space["slug"],
    @Query() query: DeliveryLocaleRequestDto,
  ): Promise<DeliveryTagResponseDto[]> {
    const scope = await this.scope(request, site, space, query);
    return this.deliveryService.listTags(scope);
  }

  @SerializeOptions({ type: DeliveryTagDetailResponseDto })
  @Get("tags/:slug")
  async getTag(
    @Req() request: Request,
    @Param("site") site: Site["slug"],
    @Param("space") space: Space["slug"],
    @Param("slug") slug: Tag["slug"],
    @Query() query: DeliveryLocaleRequestDto,
  ): Promise<DeliveryTagDetailResponseDto> {
    const scope = await this.scope(request, site, space, query);
    return this.deliveryService.getTag(scope, slug);
  }

  @SerializeOptions({ type: DeliveryAuthorResponseDto })
  @Get("authors")
  async listAuthors(
    @Req() request: Request,
    @Param("site") site: Site["slug"],
    @Param("space") space: Space["slug"],
    @Query() query: DeliveryLocaleRequestDto,
  ): Promise<DeliveryAuthorResponseDto[]> {
    const scope = await this.scope(request, site, space, query);
    return this.deliveryService.listAuthors(scope);
  }

  @SerializeOptions({ type: DeliveryAuthorResponseDto })
  @Get("authors/:authorId")
  async getAuthor(
    @Req() request: Request,
    @Param("site") site: Site["slug"],
    @Param("space") space: Space["slug"],
    @Param("authorId") authorId: Author["id"],
    @Query() query: DeliveryLocaleRequestDto,
  ): Promise<DeliveryAuthorResponseDto> {
    const scope = await this.scope(request, site, space, query);
    return this.deliveryService.getAuthor(scope, authorId);
  }

  @SerializeOptions({ type: DeliveryFeaturedArticlesResponseDto })
  @Get("featured-articles")
  async getFeaturedArticles(
    @Req() request: Request,
    @Param("site") site: Site["slug"],
    @Param("space") space: Space["slug"],
    @Query() query: DeliveryLocaleRequestDto,
  ): Promise<DeliveryFeaturedArticlesResponseDto> {
    const scope = await this.scope(request, site, space, query);
    return this.deliveryService.getFeaturedArticles(scope);
  }

  /** What a Preview link's token points at, so the website can open its own page for it. */
  @SerializeOptions({ type: DeliveryPreviewTargetResponseDto })
  @Get("preview")
  resolvePreview(
    @Req() request: Request,
    @Param("space") space: Space["slug"],
    @Query() query: DeliveryPreviewRequestDto,
  ): Promise<DeliveryPreviewTargetResponseDto> {
    const apiKey = this.allowPreview(request);
    return this.previewService.resolve(apiKey.siteId, space, query.token);
  }

  private scope(
    request: Request,
    site: Site["slug"],
    space: Space["slug"],
    query: DeliveryLocaleRequestDto,
  ) {
    const preview = query.preview === true;
    if (preview) this.allowPreview(request);
    return this.deliveryService.scope(site, space, query.locale, preview);
  }

  /** Drafts only for a key allowed them, and never into a shared cache on the way back. */
  private allowPreview(request: Request) {
    const { apiKey } = request;
    if (!apiKey?.canPreview)
      throw new ForbiddenException(
        "This API key can't read drafts. Create one that can in Settings → API keys, and use it only while previewing",
      );
    request.res?.setHeader("Cache-Control", "private, no-store");
    request.res?.setHeader("X-Loom-Preview", "true");
    return apiKey;
  }
}
