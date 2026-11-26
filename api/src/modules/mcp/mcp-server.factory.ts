import { CmsRole } from "@loom/database";
import { RICH_TEXT_ENTRY_TYPES } from "@loom/dto/constants";
import { RICH_TEXT_SCHEMA } from "@loom/dto/rich-text";
import { McpServer } from "@modelcontextprotocol/server";
import { Injectable } from "@nestjs/common";
import { ActivityService } from "../activity/activity.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import { AuthorService } from "../author/author.service";
import { BlogService } from "../blog/blog.service";
import { CategoryService } from "../category/category.service";
import { ContentContextService } from "../content/content-context.service";
import { ContentQueryService } from "../content/content-query.service";
import { CtaService } from "../cta/cta.service";
import { FeaturedArticlesService } from "../featured-articles/featured-articles.service";
import { MediaService } from "../media/media.service";
import { PrismaService } from "../prisma/prisma.service";
import { SearchService } from "../search/search.service";
import { SiteService } from "../site/site.service";
import { TagService } from "../tag/tag.service";
import { PublishService } from "../workflow/publish.service";
import { ReviewService } from "../workflow/review.service";
import { MCP_SERVER_INFO } from "./mcp.constants";
import type { McpServices } from "./mcp.context";
import { registerAuthorTools } from "./tools/author.tools";
import { registerCategoryTools } from "./tools/category.tools";
import { registerCtaTools } from "./tools/cta.tools";
import { registerFeaturedTools } from "./tools/featured.tools";
import { registerPostTools } from "./tools/post.tools";
import { registerTagTools } from "./tools/tag.tools";
import { registerWorkspaceTools } from "./tools/workspace.tools";

// Read off the schema the editor and the API share, so the description cannot drift from it
const NODES = Object.keys(RICH_TEXT_SCHEMA.nodes).join(", ");
const MARKS = Object.keys(RICH_TEXT_SCHEMA.marks).join(", ");

const ROLE_NAMES: Record<CmsRole, string> = {
  [CmsRole.ADMIN]: "an Admin",
  [CmsRole.AUTHOR]: "an Author",
  [CmsRole.WRITER]: "a Writer",
};

/** What a client is told once, on connecting: how Loom is shaped, and what is left to people. */
export function mcpInstructions(user: AuthenticatedUser): string {
  const who = user.name ? `${user.name} (${user.email})` : user.email;
  const role = ROLE_NAMES[user.role];
  return [
    `Loom is a multi-site, multilingual headless CMS: blog posts, categories, tags, authors, calls to action (CTAs) and a Featured Articles list, plus a media library every site shares. You act as ${who}, ${role}: everything you save is recorded as theirs.`,
    "Content lives in a space of a site. Call list_sites first for the spaceIds and each site's languages.",
    "Every item has shared fields, the same in every language (relations, pictures, and the slugs of categories and tags), and text per language. The site's default language is the source the other languages are translated from. A tool's language is a code from list_sites and defaults to the site's default language; shared fields are saved with the default language.",
    "Each language of an item has its own state. status is DRAFT, IN_REVIEW, PUBLISHED, CHANGED (edited since it was published) or UNPUBLISHED. live says whether the website shows it. translation is source (the default language), current, stale (the source changed since) or untracked.",
    "Saving never publishes. Every save is a new version; on a live language the website keeps showing the published version until a person publishes the new one. editorPath is the item's page in the Loom admin app. Publishing, unpublishing, the Trash, permanent deletion, restoring old versions, machine translation and uploading pictures are done by people in Loom.",
    ...(user.role === CmsRole.WRITER
      ? [
          "As a Writer you cannot publish: send finished work to an Author or Admin with submit_for_review.",
        ]
      : []),
    `A post body is a Tiptap (ProseMirror) JSON document, {"type":"doc","content":[...]}. Nodes: ${NODES}. Marks: ${MARKS}. heading takes attrs.level 1-6; link takes attrs.href (https, http, mailto, a /path or a #anchor). mediaEmbed and assetLink take attrs.mediaId, an id from list_media; ctaEmbed takes attrs.ctaId, from list_ctas; entryEmbed, entryInline and entryLink take attrs.entryType (${RICH_TEXT_ENTRY_TYPES.join(", ")}) and attrs.entryId. Whatever a body embeds must be in the post's space. To change a body, read it with get_post and send the whole document back.`,
    "A tool error is Loom's own message, the one the editor would show: fix what it names and try again.",
  ].join("\n\n");
}

/**
 * Builds the MCP server for one request, for the person it acts as. Stateless: nothing outlives the
 * request, so any instance of the API can serve the next one.
 */
@Injectable()
export class McpServerFactory {
  private readonly services: McpServices;

  constructor(
    prisma: PrismaService,
    context: ContentContextService,
    query: ContentQueryService,
    sites: SiteService,
    blogs: BlogService,
    categories: CategoryService,
    tags: TagService,
    authors: AuthorService,
    ctas: CtaService,
    featured: FeaturedArticlesService,
    media: MediaService,
    search: SearchService,
    activity: ActivityService,
    review: ReviewService,
    publish: PublishService,
  ) {
    this.services = {
      prisma,
      context,
      query,
      sites,
      blogs,
      categories,
      tags,
      authors,
      ctas,
      featured,
      media,
      search,
      activity,
      review,
      publish,
    };
  }

  create(user: AuthenticatedUser): McpServer {
    const ctx = { ...this.services, user };
    const server = new McpServer(MCP_SERVER_INFO, {
      instructions: mcpInstructions(user),
    });

    registerWorkspaceTools(server, ctx);
    registerPostTools(server, ctx);
    registerCategoryTools(server, ctx);
    registerTagTools(server, ctx);
    registerAuthorTools(server, ctx);
    registerCtaTools(server, ctx);
    registerFeaturedTools(server, ctx);

    return server;
  }
}
