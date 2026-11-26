import type { ActivityService } from "../activity/activity.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import type { AuthorService } from "../author/author.service";
import type { BlogService } from "../blog/blog.service";
import type { CategoryService } from "../category/category.service";
import type { ContentContextService } from "../content/content-context.service";
import type { ContentQueryService } from "../content/content-query.service";
import type { CtaService } from "../cta/cta.service";
import type { FeaturedArticlesService } from "../featured-articles/featured-articles.service";
import type { MediaService } from "../media/media.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { SearchService } from "../search/search.service";
import type { SiteService } from "../site/site.service";
import type { TagService } from "../tag/tag.service";
import type { PublishService } from "../workflow/publish.service";
import type { ReviewService } from "../workflow/review.service";

/** The services the tools are built on: the same ones the admin API's controllers call. */
export interface McpServices {
  prisma: PrismaService;
  context: ContentContextService;
  query: ContentQueryService;
  sites: SiteService;
  blogs: BlogService;
  categories: CategoryService;
  tags: TagService;
  authors: AuthorService;
  ctas: CtaService;
  featured: FeaturedArticlesService;
  media: MediaService;
  search: SearchService;
  activity: ActivityService;
  review: ReviewService;
  publish: PublishService;
}

/** What a tool runs with: the services, and the person the request acts as. */
export interface McpContext extends McpServices {
  user: AuthenticatedUser;
}
