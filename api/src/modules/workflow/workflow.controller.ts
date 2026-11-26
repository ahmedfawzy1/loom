import {
  type BlogVersion,
  CmsContentType,
  CmsRole,
  type SiteLanguage,
} from "@loom/database";
import {
  BlockingReferenceResponseDto,
  BulkRequestDto,
  BulkResultResponseDto,
  ContentItemResponseDto,
  ContentVersionDetailResponseDto,
  ContentVersionResponseDto,
  LiveUsageResponseDto,
  LocaleStateResponseDto,
  RequestChangesRequestDto,
  ReviewQueueItemResponseDto,
  SpaceScopeRequestDto,
  TrashItemResponseDto,
} from "@loom/dto";
import { CONTENT_TYPE_LABELS } from "@loom/dto/constants";
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  SerializeOptions,
} from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/current-user.decorator";
import { Roles } from "../auth/role.decorator";
import { AuthorService } from "../author/author.service";
import { BlogService } from "../blog/blog.service";
import { CategoryService } from "../category/category.service";
import type { CanonicalRow } from "../content/content-item.util";
import { VersionService } from "../content/version.service";
import { CtaService } from "../cta/cta.service";
import { FeaturedArticlesService } from "../featured-articles/featured-articles.service";
import { TagService } from "../tag/tag.service";
import { BulkService } from "./bulk.service";
import { ContentTypePipe } from "./content-type.pipe";
import { PublishService } from "./publish.service";
import { ReviewService } from "./review.service";
import { TrashService } from "./trash.service";

const EDITORS = [CmsRole.ADMIN, CmsRole.AUTHOR, CmsRole.WRITER] as const;
const PUBLISHERS = [CmsRole.ADMIN, CmsRole.AUTHOR] as const;

type Restore = (
  actor: AuthenticatedUser,
  id: CanonicalRow["id"],
  languageCode: SiteLanguage["code"],
  revision: BlogVersion["revision"],
) => Promise<unknown>;

type Duplicate = (
  actor: AuthenticatedUser,
  id: CanonicalRow["id"],
) => Promise<ContentItemResponseDto>;

/**
 * The lifecycle every content type shares — versions, publish and review, trash, duplicate —
 * addressed as `admin/content/:type/…`. Under its own prefix rather than a bare
 * `admin/:type`, which would sit in the same route space as `admin/sites` and `admin/media`.
 */
@Controller("admin")
export class WorkflowController {
  private readonly restorers: Record<CmsContentType, Restore>;
  private readonly duplicators: Partial<Record<CmsContentType, Duplicate>>;

  constructor(
    private readonly publishService: PublishService,
    private readonly trashService: TrashService,
    private readonly reviewService: ReviewService,
    private readonly versionService: VersionService,
    private readonly bulkService: BulkService,
    blogService: BlogService,
    categoryService: CategoryService,
    tagService: TagService,
    authorService: AuthorService,
    ctaService: CtaService,
    featuredArticlesService: FeaturedArticlesService,
  ) {
    // Restoring and duplicating re-run each type's own validation, so they stay in its service
    this.restorers = {
      [CmsContentType.BLOG]: (...args) => blogService.restoreVersion(...args),
      [CmsContentType.CATEGORY]: (...args) =>
        categoryService.restoreVersion(...args),
      [CmsContentType.TAG]: (...args) => tagService.restoreVersion(...args),
      [CmsContentType.AUTHOR]: (...args) =>
        authorService.restoreVersion(...args),
      [CmsContentType.CTA]: (...args) => ctaService.restoreVersion(...args),
      [CmsContentType.FEATURED_ARTICLES]: (...args) =>
        featuredArticlesService.restoreVersion(...args),
    };
    this.duplicators = {
      [CmsContentType.BLOG]: (...args) => blogService.duplicate(...args),
      [CmsContentType.CATEGORY]: (...args) =>
        categoryService.duplicate(...args),
      [CmsContentType.TAG]: (...args) => tagService.duplicate(...args),
      [CmsContentType.AUTHOR]: (...args) => authorService.duplicate(...args),
      [CmsContentType.CTA]: (...args) => ctaService.duplicate(...args),
    };
  }

  @Get("review-queue")
  @SerializeOptions({ type: ReviewQueueItemResponseDto })
  reviewQueue(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: SpaceScopeRequestDto,
  ): Promise<ReviewQueueItemResponseDto[]> {
    return this.reviewService.queue(actor, query.spaceId);
  }

  @Get("trash")
  @SerializeOptions({ type: TrashItemResponseDto })
  trashList(
    @Query() query: SpaceScopeRequestDto,
  ): Promise<TrashItemResponseDto[]> {
    return this.trashService.list(query.spaceId);
  }

  @Get("content/:type/:id/locales/:language/versions")
  @SerializeOptions({ type: ContentVersionResponseDto })
  versions(
    @Param("type", ContentTypePipe) type: CmsContentType,
    @Param("id") id: CanonicalRow["id"],
    @Param("language") language: SiteLanguage["code"],
  ): Promise<ContentVersionResponseDto[]> {
    return this.versionService.list(type, id, language);
  }

  @Get("content/:type/:id/locales/:language/versions/:revision")
  @SerializeOptions({ type: ContentVersionDetailResponseDto })
  version(
    @Param("type", ContentTypePipe) type: CmsContentType,
    @Param("id") id: CanonicalRow["id"],
    @Param("language") language: SiteLanguage["code"],
    @Param("revision", ParseIntPipe) revision: BlogVersion["revision"],
  ): Promise<ContentVersionDetailResponseDto> {
    return this.versionService.get(type, id, language, revision);
  }

  /** Every role may restore; the result is an ordinary save and still needs publishing. */
  @Post("content/:type/:id/locales/:language/versions/:revision/restore")
  @Roles(...EDITORS)
  @SerializeOptions({ type: ContentItemResponseDto })
  async restoreVersion(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("type", ContentTypePipe) type: CmsContentType,
    @Param("id") id: CanonicalRow["id"],
    @Param("language") language: SiteLanguage["code"],
    @Param("revision", ParseIntPipe) revision: BlogVersion["revision"],
  ): Promise<ContentItemResponseDto> {
    await this.restorers[type](actor, id, language, revision);
    return { type, id };
  }

  @Post("content/:type/:id/locales/:language/submit")
  @Roles(CmsRole.WRITER)
  @SerializeOptions({ type: LocaleStateResponseDto })
  submit(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("type", ContentTypePipe) type: CmsContentType,
    @Param("id") id: CanonicalRow["id"],
    @Param("language") language: SiteLanguage["code"],
  ): Promise<LocaleStateResponseDto> {
    return this.publishService.submit(actor, type, id, language);
  }

  @Post("content/:type/:id/locales/:language/approve")
  @Roles(...PUBLISHERS)
  @SerializeOptions({ type: LocaleStateResponseDto })
  approve(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("type", ContentTypePipe) type: CmsContentType,
    @Param("id") id: CanonicalRow["id"],
    @Param("language") language: SiteLanguage["code"],
  ): Promise<LocaleStateResponseDto> {
    return this.publishService.approve(actor, type, id, language);
  }

  @Post("content/:type/:id/locales/:language/request-changes")
  @Roles(...PUBLISHERS)
  @SerializeOptions({ type: LocaleStateResponseDto })
  requestChanges(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("type", ContentTypePipe) type: CmsContentType,
    @Param("id") id: CanonicalRow["id"],
    @Param("language") language: SiteLanguage["code"],
    @Body() args: RequestChangesRequestDto,
  ): Promise<LocaleStateResponseDto> {
    return this.publishService.requestChanges(
      actor,
      type,
      id,
      language,
      args.note,
    );
  }

  @Post("content/:type/:id/locales/:language/publish")
  @Roles(...PUBLISHERS)
  @SerializeOptions({ type: LocaleStateResponseDto })
  publish(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("type", ContentTypePipe) type: CmsContentType,
    @Param("id") id: CanonicalRow["id"],
    @Param("language") language: SiteLanguage["code"],
  ): Promise<LocaleStateResponseDto> {
    return this.publishService.publish(actor, type, id, language);
  }

  /** What would stop this language going live, for the editor to offer publishing first. */
  @Get("content/:type/:id/locales/:language/blocking-references")
  @SerializeOptions({ type: BlockingReferenceResponseDto })
  blockingReferences(
    @Param("type", ContentTypePipe) type: CmsContentType,
    @Param("id") id: CanonicalRow["id"],
    @Param("language") language: SiteLanguage["code"],
  ): Promise<BlockingReferenceResponseDto[]> {
    return this.publishService.blockingReferences(type, id, language);
  }

  @Post("content/:type/:id/locales/:language/unpublish")
  @Roles(...PUBLISHERS)
  @SerializeOptions({ type: LocaleStateResponseDto })
  unpublish(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("type", ContentTypePipe) type: CmsContentType,
    @Param("id") id: CanonicalRow["id"],
    @Param("language") language: SiteLanguage["code"],
  ): Promise<LocaleStateResponseDto> {
    return this.publishService.unpublish(actor, type, id, language);
  }

  @Post("content/:type/:id/duplicate")
  @Roles(...EDITORS)
  @SerializeOptions({ type: ContentItemResponseDto })
  duplicate(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("type", ContentTypePipe) type: CmsContentType,
    @Param("id") id: CanonicalRow["id"],
  ): Promise<ContentItemResponseDto> {
    const duplicate = this.duplicators[type];
    if (!duplicate)
      throw new BadRequestException(
        `${CONTENT_TYPE_LABELS[type]} belongs to its Space and cannot be duplicated`,
      );
    return duplicate(actor, id);
  }

  @Post("content/:type/:id/trash")
  @Roles(...EDITORS)
  trash(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("type", ContentTypePipe) type: CmsContentType,
    @Param("id") id: CanonicalRow["id"],
  ) {
    return this.trashService.trash(actor, type, id);
  }

  @Post("content/:type/:id/restore")
  @Roles(...EDITORS)
  restore(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("type", ContentTypePipe) type: CmsContentType,
    @Param("id") id: CanonicalRow["id"],
  ) {
    return this.trashService.restore(actor, type, id);
  }

  /** Which roles may run which action is per action, so the service checks it. */
  @Post("content/:type/bulk")
  @Roles(...EDITORS)
  @SerializeOptions({ type: BulkResultResponseDto })
  bulk(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("type", ContentTypePipe) type: CmsContentType,
    @Body() args: BulkRequestDto,
  ): Promise<BulkResultResponseDto[]> {
    return this.bulkService.run(actor, type, args);
  }

  @Get("content/:type/:id/live-usage")
  @SerializeOptions({ type: LiveUsageResponseDto })
  liveUsage(
    @Param("type", ContentTypePipe) type: CmsContentType,
    @Param("id") id: CanonicalRow["id"],
  ): Promise<LiveUsageResponseDto[]> {
    return this.bulkService.liveUsage(type, id);
  }

  @Delete("content/:type/:id")
  @Roles(...PUBLISHERS)
  purge(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("type", ContentTypePipe) type: CmsContentType,
    @Param("id") id: CanonicalRow["id"],
  ) {
    return this.trashService.purge(actor, type, id);
  }
}
