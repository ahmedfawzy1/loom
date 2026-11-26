import { type Blog, CmsContentType } from "@loom/database";
import {
  CreateBlogRequestDto,
  UpdateBlogLocaleRequestDto,
  UpdateBlogRequestDto,
} from "@loom/dto";
import {
  BLOG_DESCRIPTION_MAX_LENGTH,
  BLOG_MAX_TAGS,
  BLOG_SUMMARY_MAX_LENGTH,
  BLOG_SUMMARY_MIN_LENGTH,
  BLOG_TITLE_MAX_LENGTH,
  BLOG_UPDATE_NOTE_MAX_LENGTH,
  FAQ_ANSWER_MAX_LENGTH,
  FAQ_QUESTION_MAX_LENGTH,
} from "@loom/dto/constants";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { slugify } from "../../content/slug.util";
import type { McpContext } from "../mcp.context";
import {
  editorPath,
  languageInput,
  languageOn,
  languageStates,
  listContent,
  listInput,
  localeState,
  pictureInput,
  pictureOf,
  saveContent,
  savedOutcome,
  spaceIdInput,
  titlesOf,
} from "../mcp-content.util";
import {
  definedFields,
  READ_ONLY,
  SAVE,
  toolResult,
  validated,
} from "../mcp-tool.util";

const BLOG = CmsContentType.BLOG;

const postIdInput = z
  .string()
  .describe("A post's id, from list_posts or search.");

export const documentInput = z
  .looseObject({ type: z.literal("doc") })
  .describe(
    "The whole body: a Tiptap JSON document in Loom's schema (see the server instructions), as get_post returns it.",
  );

const faqInput = z
  .array(
    z.object({
      question: z.string().max(FAQ_QUESTION_MAX_LENGTH),
      answer: z.string().max(FAQ_ANSWER_MAX_LENGTH),
    }),
  )
  .describe("The whole FAQ, in order. [] removes every question.");

const postText = {
  title: z.string().max(BLOG_TITLE_MAX_LENGTH),
  description: z
    .string()
    .max(BLOG_DESCRIPTION_MAX_LENGTH)
    .describe("A sentence or two for listings and search results."),
  slug: z
    .string()
    .describe(
      "The URL slug, unique among this space's posts in this language. Any script is allowed.",
    ),
  summary: z
    .string()
    .max(BLOG_SUMMARY_MAX_LENGTH)
    .describe(
      `The summary shown above the body, ${BLOG_SUMMARY_MIN_LENGTH}–${BLOG_SUMMARY_MAX_LENGTH} characters. Publishing needs one. "" clears it.`,
    ),
  updateNote: z
    .string()
    .max(BLOG_UPDATE_NOTE_MAX_LENGTH)
    .describe('What changed, shown beside the "Updated" date. "" clears it.'),
  body: documentInput,
  faq: faqInput,
};

const tagIdsInput = z
  .array(z.string())
  .max(BLOG_MAX_TAGS)
  .describe("The whole tag list, in order: tag ids from list_tags.");

const saveInput = z.object({
  postId: postIdInput,
  language: languageInput.describe(
    "Which language's text to write, as a code from list_sites. Defaults to the site's default language. A language the post does not have yet is added as a translation.",
  ),
  title: postText.title.optional(),
  description: postText.description.optional(),
  slug: postText.slug
    .optional()
    .describe(
      "The URL slug, unique among this space's posts in this language. Any script is allowed. A new translation without one gets it from its title.",
    ),
  summary: postText.summary.optional(),
  updateNote: postText.updateNote.optional(),
  body: postText.body.optional(),
  faq: postText.faq.optional(),
  authorId: z
    .string()
    .optional()
    .describe("Shared. The byline: an author's id from list_authors."),
  reviewerId: z
    .string()
    .nullable()
    .optional()
    .describe("Shared. Who reviewed it: an author's id, or null for nobody."),
  categoryId: z
    .string()
    .nullable()
    .optional()
    .describe(
      "Shared. A category's id from list_categories, or null for none.",
    ),
  imageId: pictureInput("Shared. The cover picture"),
  tagIds: tagIdsInput
    .optional()
    .describe("Shared. The whole tag list, in order: tag ids from list_tags."),
});

async function readPost(
  ctx: McpContext,
  postId: Blog["id"],
  requested: string | undefined,
) {
  const blog = await ctx.blogs.get(postId);
  const { site } = await ctx.context.requireSpace(blog.spaceId);
  const language = languageOn(site, requested);
  const locale = blog.locales.find((row) => row.languageCode === language);

  const people = [blog.authorId, blog.reviewerId].filter((id): id is string =>
    Boolean(id),
  );
  const [title, authors, image] = await Promise.all([
    titlesOf(
      ctx,
      [
        ...(blog.categoryId
          ? [{ type: CmsContentType.CATEGORY, id: blog.categoryId }]
          : []),
        ...blog.tagIds.map((id) => ({ type: CmsContentType.TAG, id })),
      ],
      language,
    ),
    ctx.prisma.author.findMany({
      where: { id: { in: people } },
      select: { id: true, name: true },
    }),
    pictureOf(ctx, blog.imageId),
  ]);
  const author = (id: string | null) =>
    id
      ? {
          id,
          name: authors.find((candidate) => candidate.id === id)?.name ?? null,
        }
      : null;

  return {
    id: blog.id,
    spaceId: blog.spaceId,
    language,
    defaultLanguage: site.defaultLanguage,
    inTrash: blog.deletedAt !== null,
    shared: {
      author: author(blog.authorId),
      reviewer: author(blog.reviewerId),
      category: blog.categoryId
        ? {
            id: blog.categoryId,
            title: title(CmsContentType.CATEGORY, blog.categoryId),
          }
        : null,
      tags: blog.tagIds.map((id) => ({
        id,
        title: title(CmsContentType.TAG, id),
      })),
      image,
    },
    // null: the post has nothing in this language yet
    text: locale
      ? {
          title: locale.title,
          description: locale.description,
          slug: locale.slug,
          summary: locale.summary,
          updateNote: locale.updateNote,
          body: locale.body,
          faq: locale.faq,
        }
      : null,
    state: localeState(blog.locales, language, site.defaultLanguage),
    languages: languageStates(blog.locales, site.defaultLanguage),
    editorPath: editorPath(BLOG, blog.id),
  };
}

async function savePost(ctx: McpContext, input: z.infer<typeof saveInput>) {
  const {
    postId,
    language,
    authorId,
    reviewerId,
    categoryId,
    imageId,
    tagIds,
    ...text
  } = input;
  const blog = await ctx.blogs.get(postId);

  const saved = await saveContent(ctx, {
    item: blog,
    language,
    text: definedFields(text),
    shared: definedFields({
      authorId,
      reviewerId,
      categoryId,
      imageId,
      tagIds,
    }),
    // The fields a save requires; the rest are left as they are when not sent
    current: (code) => {
      const locale = blog.locales.find((row) => row.languageCode === code);
      return (
        locale && {
          title: locale.title,
          description: locale.description,
          slug: locale.slug,
        }
      );
    },
    requiredForNew: ["title", "description", "slug"],
    completeNew: (fields) => ({
      ...fields,
      slug:
        fields.slug ??
        (fields.title ? slugify(fields.title) || undefined : undefined),
    }),
    textDto: UpdateBlogLocaleRequestDto,
    sharedDto: UpdateBlogRequestDto,
    saveShared: (shared) => ctx.blogs.update(ctx.user, postId, shared),
    saveText: (code, fields, shared) =>
      ctx.blogs.updateLocale(ctx.user, postId, code, fields, {
        canonical: shared,
      }),
  });

  return savedOutcome(ctx, BLOG, await ctx.blogs.get(postId), saved);
}

export function registerPostTools(server: McpServer, ctx: McpContext) {
  server.registerTool(
    "list_posts",
    {
      title: "List posts",
      description:
        "Blog posts in a space, most recently edited first: title and slug in the language asked for, and where every language of each post stands.",
      inputSchema: listInput.extend({
        categoryId: z
          .string()
          .optional()
          .describe("Only posts in this category."),
        tagId: z.string().optional().describe("Only posts with this tag."),
        authorId: z
          .string()
          .optional()
          .describe("Only posts with this byline."),
      }),
      annotations: READ_ONLY,
    },
    (input) => toolResult(() => listContent(ctx, BLOG, input)),
  );

  server.registerTool(
    "get_post",
    {
      title: "Read a post",
      description:
        "One post: its shared fields (byline, reviewer, category, tags, cover picture), its text in one language (title, description, slug, summary, update note, body, FAQ), that language's state, and every language it has. This is the working copy, which can be ahead of what is live.",
      inputSchema: z.object({ postId: postIdInput, language: languageInput }),
      annotations: READ_ONLY,
    },
    ({ postId, language }) => toolResult(() => readPost(ctx, postId, language)),
  );

  server.registerTool(
    "create_post",
    {
      title: "Create a post",
      description:
        "A new draft post in the site's default language, with an empty body. Write the rest with save_post.",
      inputSchema: z.object({
        spaceId: spaceIdInput,
        title: postText.title,
        description: postText.description,
        authorId: z
          .string()
          .describe("The byline: an author's id from list_authors."),
        slug: postText.slug
          .optional()
          .describe("The URL slug. Omit it to make one from the title."),
        categoryId: z
          .string()
          .optional()
          .describe("A category's id from list_categories."),
        tagIds: tagIdsInput.optional(),
        reviewerId: z
          .string()
          .optional()
          .describe("Who reviewed it: an author's id."),
        imageId: z
          .string()
          .optional()
          .describe("The cover picture: an id from list_media."),
      }),
      annotations: SAVE,
    },
    (input) =>
      toolResult(async () => {
        const args = await validated(
          CreateBlogRequestDto,
          definedFields(input),
        );
        const blog = await ctx.blogs.create(ctx.user, args);
        const { site } = await ctx.context.requireSpace(blog.spaceId);
        return {
          ...savedOutcome(ctx, BLOG, blog, site.defaultLanguage),
          next: "Created as a draft. Write its summary, body and FAQ with save_post.",
        };
      }),
  );

  server.registerTool(
    "save_post",
    {
      title: "Save a post",
      description:
        "Writes a post. Send only the fields to change; the rest stay as they are. Text fields are for one language, and naming a language the post does not have yet adds it. Fields marked Shared are the same in every language and are saved with the default language, so send them without a language (or with the default one). Every save is a new version and never publishes: on a live language the site keeps the published text until a person publishes.",
      inputSchema: saveInput,
      annotations: SAVE,
    },
    (input) => toolResult(() => savePost(ctx, input)),
  );
}
