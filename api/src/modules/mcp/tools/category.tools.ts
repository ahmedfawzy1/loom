import { type Category, CmsContentType } from "@loom/database";
import {
  CreateCategoryRequestDto,
  UpdateCategoryLocaleRequestDto,
  UpdateCategoryRequestDto,
} from "@loom/dto";
import {
  CATEGORY_DESCRIPTION_MAX_LENGTH,
  CATEGORY_SEO_DESCRIPTION_MAX_LENGTH,
  CATEGORY_SEO_DESCRIPTION_MIN_LENGTH,
  CATEGORY_SEO_TITLE_MAX_LENGTH,
  CATEGORY_TITLE_MAX_LENGTH,
  GAME_CODE_MAX_LENGTH,
  SLUG_MAX_LENGTH,
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

const CATEGORY = CmsContentType.CATEGORY;

const categoryIdInput = z
  .string()
  .describe("A category's id, from list_categories or search.");

const slugInput = z
  .string()
  .max(SLUG_MAX_LENGTH)
  .describe(
    "The URL slug, the same in every language: lowercase letters, digits and single hyphens, unique in the space.",
  );

const gameCodeInput = z
  .string()
  .max(GAME_CODE_MAX_LENGTH)
  .describe(
    "A short internal code for the category, the same in every language: lowercase letters and digits only.",
  );

const categoryText = {
  title: z.string().max(CATEGORY_TITLE_MAX_LENGTH),
  description: z.string().max(CATEGORY_DESCRIPTION_MAX_LENGTH),
  seoMetaTitle: z
    .string()
    .max(CATEGORY_SEO_TITLE_MAX_LENGTH)
    .describe(
      'The page title search engines show, unique in the space and language. "" clears it.',
    ),
  seoMetaDescription: z
    .string()
    .max(CATEGORY_SEO_DESCRIPTION_MAX_LENGTH)
    .describe(
      `The description search engines show, ${CATEGORY_SEO_DESCRIPTION_MIN_LENGTH}–${CATEGORY_SEO_DESCRIPTION_MAX_LENGTH} characters. "" clears it.`,
    ),
};

const saveInput = z.object({
  categoryId: categoryIdInput,
  language: languageInput.describe(
    "Which language's text to write, as a code from list_sites. Defaults to the site's default language. A language the category does not have yet is added as a translation.",
  ),
  title: categoryText.title.optional(),
  description: categoryText.description.optional(),
  seoMetaTitle: categoryText.seoMetaTitle.optional(),
  seoMetaDescription: categoryText.seoMetaDescription.optional(),
  slug: slugInput.optional().describe(`Shared. ${slugInput.description}`),
  gameCode: gameCodeInput
    .optional()
    .describe(`Shared. ${gameCodeInput.description}`),
  featuredImageId: pictureInput("Shared. The featured image"),
  featureIconId: pictureInput("Shared. The feature icon"),
  gameCoverId: pictureInput("Shared. The cover image"),
});

async function readCategory(
  ctx: McpContext,
  categoryId: Category["id"],
  requested: string | undefined,
) {
  const category = await ctx.categories.get(categoryId);
  const { site } = await ctx.context.requireSpace(category.spaceId);
  const language = languageOn(site, requested);
  const locale = category.locales.find((row) => row.languageCode === language);
  const [featuredImage, featureIcon, gameCover] = await Promise.all([
    pictureOf(ctx, category.featuredImageId),
    pictureOf(ctx, category.featureIconId),
    pictureOf(ctx, category.gameCoverId),
  ]);

  return {
    id: category.id,
    spaceId: category.spaceId,
    language,
    defaultLanguage: site.defaultLanguage,
    inTrash: category.deletedAt !== null,
    shared: {
      slug: category.slug,
      gameCode: category.gameCode,
      featuredImage,
      featureIcon,
      gameCover,
    },
    text: locale
      ? {
          title: locale.title,
          description: locale.description,
          seoMetaTitle: locale.seoMetaTitle,
          seoMetaDescription: locale.seoMetaDescription,
        }
      : null,
    state: localeState(category.locales, language, site.defaultLanguage),
    languages: languageStates(category.locales, site.defaultLanguage),
    editorPath: editorPath(CATEGORY, category.id),
  };
}

async function saveCategory(ctx: McpContext, input: z.infer<typeof saveInput>) {
  const {
    categoryId,
    language,
    slug,
    gameCode,
    featuredImageId,
    featureIconId,
    gameCoverId,
    ...text
  } = input;
  const category = await ctx.categories.get(categoryId);

  const saved = await saveContent(ctx, {
    item: category,
    language,
    text: definedFields(text),
    shared: definedFields({
      slug,
      gameCode,
      featuredImageId,
      featureIconId,
      gameCoverId,
    }),
    current: (code) => {
      const locale = category.locales.find((row) => row.languageCode === code);
      return locale && { title: locale.title, description: locale.description };
    },
    requiredForNew: ["title", "description"],
    textDto: UpdateCategoryLocaleRequestDto,
    sharedDto: UpdateCategoryRequestDto,
    saveShared: (shared) => ctx.categories.update(ctx.user, categoryId, shared),
    saveText: (code, fields, shared) =>
      ctx.categories.updateLocale(ctx.user, categoryId, code, fields, {
        canonical: shared,
      }),
  });

  return savedOutcome(
    ctx,
    CATEGORY,
    await ctx.categories.get(categoryId),
    saved,
  );
}

export function registerCategoryTools(server: McpServer, ctx: McpContext) {
  server.registerTool(
    "list_categories",
    {
      title: "List categories",
      description:
        "Categories in a space, most recently edited first, with where every language of each stands.",
      inputSchema: listInput,
      annotations: READ_ONLY,
    },
    (input) => toolResult(() => listContent(ctx, CATEGORY, input)),
  );

  server.registerTool(
    "get_category",
    {
      title: "Read a category",
      description:
        "One category: its shared fields (slug, game code, images), its text in one language (title, description, SEO title and description), that language's state, and every language it has.",
      inputSchema: z.object({
        categoryId: categoryIdInput,
        language: languageInput,
      }),
      annotations: READ_ONLY,
    },
    ({ categoryId, language }) =>
      toolResult(() => readCategory(ctx, categoryId, language)),
  );

  server.registerTool(
    "create_category",
    {
      title: "Create a category",
      description:
        "A new draft category, with its text in the site's default language. Add translations and SEO text with save_category.",
      inputSchema: z.object({
        spaceId: spaceIdInput,
        title: categoryText.title,
        description: categoryText.description,
        slug: slugInput,
        gameCode: gameCodeInput,
        featuredImageId: z
          .string()
          .optional()
          .describe("An id from list_media."),
        featureIconId: z.string().optional().describe("An id from list_media."),
        gameCoverId: z.string().optional().describe("An id from list_media."),
      }),
      annotations: SAVE,
    },
    (input) =>
      toolResult(async () => {
        const args = await validated(
          CreateCategoryRequestDto,
          definedFields(input),
        );
        const category = await ctx.categories.create(ctx.user, args);
        const { site } = await ctx.context.requireSpace(category.spaceId);
        return savedOutcome(ctx, CATEGORY, category, site.defaultLanguage);
      }),
  );

  server.registerTool(
    "save_category",
    {
      title: "Save a category",
      description:
        "Writes a category. Send only the fields to change; the rest stay as they are. Text fields are for one language, and naming a language the category does not have yet adds it. Fields marked Shared are the same in every language and are saved with the default language. Every save is a new version and never publishes.",
      inputSchema: saveInput,
      annotations: SAVE,
    },
    (input) => toolResult(() => saveCategory(ctx, input)),
  );
}
