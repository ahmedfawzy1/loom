import { CmsContentType, type Space } from "@loom/database";
import { UpdateFeaturedArticlesRequestDto } from "@loom/dto";
import {
  FEATURED_ARTICLES_MAX,
  FEATURED_ARTICLES_MIN,
} from "@loom/dto/constants";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { McpContext } from "../mcp.context";
import {
  editorPath,
  languageInput,
  languageOn,
  languageStates,
  localeState,
  savedOutcome,
  spaceIdInput,
  titlesOf,
} from "../mcp-content.util";
import { READ_ONLY, SAVE, toolResult, validated } from "../mcp-tool.util";

const FEATURED = CmsContentType.FEATURED_ARTICLES;

async function readFeatured(
  ctx: McpContext,
  spaceId: Space["id"],
  requested: string | undefined,
) {
  const { site } = await ctx.context.requireSpace(spaceId);
  const language = languageOn(site, requested);
  const featured = await ctx.featured.get(spaceId);
  const postIds =
    featured.locales.find((locale) => locale.languageCode === language)
      ?.blogIds ?? [];

  const [title, live] = await Promise.all([
    titlesOf(
      ctx,
      postIds.map((id) => ({ type: CmsContentType.BLOG, id })),
      language,
    ),
    // A listed post that is not live in this language is skipped by the website
    ctx.prisma.blogLocale.findMany({
      where: {
        blogId: { in: postIds },
        languageCode: language,
        publishedRevision: { not: null },
      },
      select: { blogId: true },
    }),
  ]);
  const liveIds = new Set(live.map((row) => row.blogId));

  return {
    id: featured.id,
    spaceId,
    language,
    defaultLanguage: site.defaultLanguage,
    posts: postIds.map((id) => ({
      id,
      title: title(CmsContentType.BLOG, id),
      liveInThisLanguage: liveIds.has(id),
    })),
    state: localeState(featured.locales, language, site.defaultLanguage),
    languages: languageStates(featured.locales, site.defaultLanguage),
    editorPath: editorPath(FEATURED, featured.id),
  };
}

export function registerFeaturedTools(server: McpServer, ctx: McpContext) {
  server.registerTool(
    "get_featured_posts",
    {
      title: "Read the featured posts",
      description:
        "A space's Featured Articles list for one language: the posts, in carousel order, and whether each is live in that language. Every language has its own list.",
      inputSchema: z.object({ spaceId: spaceIdInput, language: languageInput }),
      annotations: READ_ONLY,
    },
    ({ spaceId, language }) =>
      toolResult(() => readFeatured(ctx, spaceId, language)),
  );

  server.registerTool(
    "save_featured_posts",
    {
      title: "Save the featured posts",
      description:
        "Replaces one language's Featured Articles list with these posts, in this order. It is a new version and never publishes.",
      inputSchema: z.object({
        spaceId: spaceIdInput,
        language: languageInput,
        postIds: z
          .array(z.string())
          .min(FEATURED_ARTICLES_MIN)
          .max(FEATURED_ARTICLES_MAX)
          .describe("The whole list, first to last: post ids from list_posts."),
      }),
      annotations: SAVE,
    },
    ({ spaceId, language: requested, postIds }) =>
      toolResult(async () => {
        const { site } = await ctx.context.requireSpace(spaceId);
        const language = languageOn(site, requested);
        const args = await validated(UpdateFeaturedArticlesRequestDto, {
          blogIds: postIds,
        });
        const featured = await ctx.featured.updateLocale(
          ctx.user,
          spaceId,
          language,
          args,
        );
        return savedOutcome(ctx, FEATURED, featured, language);
      }),
  );
}
