import { CmsContentType, type Tag } from "@loom/database";
import {
  CreateTagRequestDto,
  UpdateTagLocaleRequestDto,
  UpdateTagRequestDto,
} from "@loom/dto";
import {
  SLUG_MAX_LENGTH,
  TAG_DESCRIPTION_MAX_LENGTH,
  TAG_TITLE_MAX_LENGTH,
} from "@loom/dto/constants";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
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
} from "../mcp-content.util";
import {
  definedFields,
  READ_ONLY,
  SAVE,
  toolResult,
  validated,
} from "../mcp-tool.util";

const TAG = CmsContentType.TAG;

const tagIdInput = z.string().describe("A tag's id, from list_tags or search.");

const slugInput = z
  .string()
  .max(SLUG_MAX_LENGTH)
  .describe(
    "The URL slug, the same in every language: lowercase letters, digits and single hyphens, unique in the space.",
  );

const tagText = {
  title: z
    .string()
    .max(TAG_TITLE_MAX_LENGTH)
    .describe('The tag\'s name, without a leading "#".'),
  description: z.string().max(TAG_DESCRIPTION_MAX_LENGTH),
};

const saveInput = z.object({
  tagId: tagIdInput,
  language: languageInput.describe(
    "Which language's text to write, as a code from list_sites. Defaults to the site's default language. A language the tag does not have yet is added as a translation.",
  ),
  title: tagText.title.optional(),
  description: tagText.description.optional(),
  slug: slugInput.optional().describe(`Shared. ${slugInput.description}`),
  featuredImageId: pictureInput("Shared. The featured image"),
});

async function readTag(
  ctx: McpContext,
  tagId: Tag["id"],
  requested: string | undefined,
) {
  const tag = await ctx.tags.get(tagId);
  const { site } = await ctx.context.requireSpace(tag.spaceId);
  const language = languageOn(site, requested);
  const locale = tag.locales.find((row) => row.languageCode === language);

  return {
    id: tag.id,
    spaceId: tag.spaceId,
    language,
    defaultLanguage: site.defaultLanguage,
    inTrash: tag.deletedAt !== null,
    shared: {
      slug: tag.slug,
      featuredImage: await pictureOf(ctx, tag.featuredImageId),
    },
    text: locale
      ? { title: locale.title, description: locale.description }
      : null,
    state: localeState(tag.locales, language, site.defaultLanguage),
    languages: languageStates(tag.locales, site.defaultLanguage),
    editorPath: editorPath(TAG, tag.id),
  };
}

async function saveTag(ctx: McpContext, input: z.infer<typeof saveInput>) {
  const { tagId, language, slug, featuredImageId, ...text } = input;
  const tag = await ctx.tags.get(tagId);

  const saved = await saveContent(ctx, {
    item: tag,
    language,
    text: definedFields(text),
    shared: definedFields({ slug, featuredImageId }),
    current: (code) => {
      const locale = tag.locales.find((row) => row.languageCode === code);
      return locale && { title: locale.title, description: locale.description };
    },
    requiredForNew: ["title", "description"],
    textDto: UpdateTagLocaleRequestDto,
    sharedDto: UpdateTagRequestDto,
    saveShared: (shared) => ctx.tags.update(ctx.user, tagId, shared),
    saveText: (code, fields, shared) =>
      ctx.tags.updateLocale(ctx.user, tagId, code, fields, {
        canonical: shared,
      }),
  });

  return savedOutcome(ctx, TAG, await ctx.tags.get(tagId), saved);
}

export function registerTagTools(server: McpServer, ctx: McpContext) {
  server.registerTool(
    "list_tags",
    {
      title: "List tags",
      description:
        "Tags in a space, most recently edited first, with where every language of each stands.",
      inputSchema: listInput,
      annotations: READ_ONLY,
    },
    (input) => toolResult(() => listContent(ctx, TAG, input)),
  );

  server.registerTool(
    "get_tag",
    {
      title: "Read a tag",
      description:
        "One tag: its shared fields (slug, featured image), its text in one language (title, description), that language's state, and every language it has.",
      inputSchema: z.object({ tagId: tagIdInput, language: languageInput }),
      annotations: READ_ONLY,
    },
    ({ tagId, language }) => toolResult(() => readTag(ctx, tagId, language)),
  );

  server.registerTool(
    "create_tag",
    {
      title: "Create a tag",
      description:
        "A new draft tag, with its text in the site's default language. Add translations with save_tag.",
      inputSchema: z.object({
        spaceId: spaceIdInput,
        title: tagText.title,
        description: tagText.description,
        slug: slugInput,
        featuredImageId: z
          .string()
          .optional()
          .describe("An id from list_media."),
      }),
      annotations: SAVE,
    },
    (input) =>
      toolResult(async () => {
        const args = await validated(CreateTagRequestDto, definedFields(input));
        const tag = await ctx.tags.create(ctx.user, args);
        const { site } = await ctx.context.requireSpace(tag.spaceId);
        return savedOutcome(ctx, TAG, tag, site.defaultLanguage);
      }),
  );

  server.registerTool(
    "save_tag",
    {
      title: "Save a tag",
      description:
        "Writes a tag. Send only the fields to change; the rest stay as they are. Text fields are for one language, and naming a language the tag does not have yet adds it. Fields marked Shared are the same in every language and are saved with the default language. Every save is a new version and never publishes.",
      inputSchema: saveInput,
      annotations: SAVE,
    },
    (input) => toolResult(() => saveTag(ctx, input)),
  );
}
