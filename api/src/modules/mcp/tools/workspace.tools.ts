import { CmsRole } from "@loom/database";
import {
  ListActivityRequestDto,
  ListMediaRequestDto,
  SearchRequestDto,
} from "@loom/dto";
import {
  SEARCH_QUERY_MAX_LENGTH,
  SEARCH_QUERY_MIN_LENGTH,
} from "@loom/dto/constants";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { requireItem } from "../../content/content-item.util";
import { MCP_PAGE_SIZE } from "../mcp.constants";
import type { McpContext } from "../mcp.context";
import {
  editorPath,
  ITEM_TYPES,
  itemTypeInput,
  itemTypeName,
  languageInput,
  languageOn,
  pageInput,
  spaceIdInput,
} from "../mcp-content.util";
import {
  definedFields,
  READ_ONLY,
  SAVE,
  toolResult,
  validated,
} from "../mcp-tool.util";

/** Where to start, what to look up, and what has been happening — the tools that are not one content type. */
export function registerWorkspaceTools(server: McpServer, ctx: McpContext) {
  server.registerTool(
    "list_sites",
    {
      title: "List sites and spaces",
      description:
        "Every site with its languages (the default one first is the source the others translate) and its spaces. Content lives in a space, so start here for the spaceId the other tools take. Also says who you are signed in as.",
      inputSchema: z.object({}),
      annotations: READ_ONLY,
    },
    () =>
      toolResult(async () => {
        const sites = await ctx.sites.listSites();
        return {
          signedInAs: {
            name: ctx.user.name,
            email: ctx.user.email,
            role: ctx.user.role,
          },
          sites: sites.map((site) => ({
            id: site.id,
            name: site.name,
            slug: site.slug,
            domain: site.domain,
            defaultLanguage: site.defaultLanguage,
            languages: site.languages
              .filter((language) => language.enabled)
              .map((language) => ({
                code: language.code,
                name: language.label,
              })),
            spaces: site.spaces.map((space) => ({
              id: space.id,
              name: space.name,
              slug: space.slug,
            })),
          })),
        };
      }),
  );

  server.registerTool(
    "search",
    {
      title: "Search a space",
      description:
        "Finds posts, categories, tags, authors and CTAs in a space by title (typos allowed), description or slug, in any language. Each item appears once, in the language it matched best. Bodies are not searched.",
      inputSchema: z.object({
        spaceId: spaceIdInput,
        query: z
          .string()
          .min(SEARCH_QUERY_MIN_LENGTH)
          .max(SEARCH_QUERY_MAX_LENGTH),
        language: languageInput.describe(
          "The language to prefer when an item matches in several. Defaults to the site's default language.",
        ),
      }),
      annotations: READ_ONLY,
    },
    ({ spaceId, query, language: requested }) =>
      toolResult(async () => {
        const { site } = await ctx.context.requireSpace(spaceId);
        const language = languageOn(site, requested);
        const hits = await ctx.search.search(
          await validated(SearchRequestDto, { spaceId, language, q: query }),
        );
        return hits.map((hit) => ({
          type: itemTypeName(hit.type),
          id: hit.id,
          title: hit.title,
          language: hit.languageCode,
          slug: hit.slug,
        }));
      }),
  );

  server.registerTool(
    "list_media",
    {
      title: "List pictures",
      description:
        "The media library, newest first. It is shared by every site. Use a picture's id wherever a tool or a body asks for one (imageId, mediaEmbed, assetLink); url is where it is served from.",
      inputSchema: z.object({
        query: z
          .string()
          .optional()
          .describe("Matches file names and alt text."),
        page: pageInput,
      }),
      annotations: READ_ONLY,
    },
    ({ query, page }) =>
      toolResult(async () => {
        const { items, pagination } = await ctx.media.list(
          await validated(
            ListMediaRequestDto,
            definedFields({ q: query, page, pageSize: MCP_PAGE_SIZE }),
          ),
        );
        return {
          items: items.map((media) => ({
            id: media.id,
            filename: media.filename,
            altText: media.altText,
            width: media.width,
            height: media.height,
            url: media.url,
          })),
          page: pagination.page,
          totalPages: pagination.totalPages,
          total: pagination.total,
        };
      }),
  );

  server.registerTool(
    "list_review_queue",
    {
      title: "List the review queue",
      description:
        "For Authors and Admins: everything waiting for review in a space, oldest first. For Writers: their own recent submissions and what happened to each, including any note asking for changes.",
      inputSchema: z.object({ spaceId: spaceIdInput }),
      annotations: READ_ONLY,
    },
    ({ spaceId }) =>
      toolResult(async () => {
        await ctx.context.requireSpace(spaceId);
        const items = await ctx.review.queue(ctx.user, spaceId);
        return items.map((item) => ({
          type: itemTypeName(item.type),
          id: item.id,
          title: item.title,
          language: item.languageCode,
          status: item.status,
          submittedAt: item.submittedAt,
          submittedBy:
            item.submittedBy?.name ?? item.submittedBy?.email ?? null,
          reviewNote: item.reviewNote,
          editorPath: editorPath(item.type, item.id),
        }));
      }),
  );

  server.registerTool(
    "list_activity",
    {
      title: "List recent activity",
      description:
        "The activity log, newest first: who created, edited, submitted, published or deleted what, and when.",
      inputSchema: z.object({
        spaceId: spaceIdInput
          .optional()
          .describe(
            "Only this space. Omit it for everything, settings and users included.",
          ),
        type: itemTypeInput.optional().describe("Only this kind of content."),
        itemId: z.string().optional().describe("Only this item's history."),
        language: languageInput.describe(
          "The language to show item titles in, falling back to each item's default language.",
        ),
        page: pageInput,
      }),
      annotations: READ_ONLY,
    },
    ({ spaceId, type, itemId, language: requested, page }) =>
      toolResult(async () => {
        const language = spaceId
          ? languageOn(
              (await ctx.context.requireSpace(spaceId)).site,
              requested,
            )
          : (requested ?? "en");
        const { items, pagination } = await ctx.activity.list(
          await validated(
            ListActivityRequestDto,
            definedFields({
              spaceId,
              language,
              contentType: type ? ITEM_TYPES[type] : undefined,
              contentId: itemId,
              page,
              pageSize: MCP_PAGE_SIZE,
            }),
          ),
        );
        return {
          items: items.map((entry) => ({
            at: entry.createdAt,
            by: entry.userEmail,
            action: entry.action,
            type: entry.contentType ? itemTypeName(entry.contentType) : null,
            id: entry.contentId,
            title: entry.contentTitle,
            language: entry.languageCode,
            space: entry.spaceName,
          })),
          page: pagination.page,
          totalPages: pagination.totalPages,
          total: pagination.total,
        };
      }),
  );

  // Only Writers submit: Authors and Admins publish, which is left to them in Loom itself
  if (ctx.user.role === CmsRole.WRITER)
    server.registerTool(
      "submit_for_review",
      {
        title: "Submit for review",
        description:
          "Sends one language of an item to the review queue, for an Author or Admin to approve and publish or send back with a note. Saving it again before then withdraws the submission.",
        inputSchema: z.object({
          type: itemTypeInput,
          id: z
            .string()
            .describe(
              "The item's id. For featured_posts, the id get_featured_posts returns.",
            ),
          language: languageInput,
        }),
        annotations: SAVE,
      },
      ({ type, id, language: requested }) =>
        toolResult(async () => {
          const contentType = ITEM_TYPES[type];
          const item = await requireItem(ctx.prisma, contentType, id);
          const { site } = await ctx.context.requireSpace(item.spaceId);
          const language = languageOn(site, requested);
          const state = await ctx.publish.submit(
            ctx.user,
            contentType,
            id,
            language,
          );
          return {
            type,
            id,
            language,
            status: state.status,
            editorPath: editorPath(contentType, id),
            next: "Waiting for an Author or Admin. list_review_queue shows what happens to it.",
          };
        }),
    );
}
