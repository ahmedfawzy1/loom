import { type Author, CmsContentType } from "@loom/database";
import {
  CreateAuthorRequestDto,
  UpdateAuthorLocaleRequestDto,
  UpdateAuthorRequestDto,
} from "@loom/dto";
import {
  AUTHOR_BIO_MAX_LENGTH,
  AUTHOR_JOB_TITLE_MAX_LENGTH,
  AUTHOR_MAX_SOCIAL_LINKS,
  AUTHOR_NAME_MAX_LENGTH,
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

const AUTHOR = CmsContentType.AUTHOR;

const authorIdInput = z
  .string()
  .describe("An author's id, from list_authors or search.");

const nameInput = z
  .string()
  .max(AUTHOR_NAME_MAX_LENGTH)
  .describe("The byline, the same in every language.");

const socialLinksInput = z
  .array(z.string())
  .max(AUTHOR_MAX_SOCIAL_LINKS)
  .describe("The whole list of profile URLs, in order.");

const authorText = {
  jobTitle: z
    .string()
    .max(AUTHOR_JOB_TITLE_MAX_LENGTH)
    .describe('"" clears it.'),
  bio: z
    .string()
    .max(AUTHOR_BIO_MAX_LENGTH)
    .describe('Plain text. "" clears it.'),
};

const saveInput = z.object({
  authorId: authorIdInput,
  language: languageInput.describe(
    "Which language's text to write, as a code from list_sites. Defaults to the site's default language. A language the author does not have yet is added as a translation.",
  ),
  jobTitle: authorText.jobTitle.optional(),
  bio: authorText.bio.optional(),
  name: nameInput.optional().describe(`Shared. ${nameInput.description}`),
  profileImageId: pictureInput("Shared. The profile picture"),
  socialLinks: socialLinksInput
    .optional()
    .describe(`Shared. ${socialLinksInput.description}`),
});

async function readAuthor(
  ctx: McpContext,
  authorId: Author["id"],
  requested: string | undefined,
) {
  const author = await ctx.authors.get(authorId);
  const { site } = await ctx.context.requireSpace(author.spaceId);
  const language = languageOn(site, requested);
  const locale = author.locales.find((row) => row.languageCode === language);

  return {
    id: author.id,
    spaceId: author.spaceId,
    language,
    defaultLanguage: site.defaultLanguage,
    inTrash: author.deletedAt !== null,
    shared: {
      name: author.name,
      profileImage: await pictureOf(ctx, author.profileImageId),
      socialLinks: author.socialLinks,
    },
    text: locale ? { jobTitle: locale.jobTitle, bio: locale.bio } : null,
    state: localeState(author.locales, language, site.defaultLanguage),
    languages: languageStates(author.locales, site.defaultLanguage),
    editorPath: editorPath(AUTHOR, author.id),
  };
}

async function saveAuthor(ctx: McpContext, input: z.infer<typeof saveInput>) {
  const { authorId, language, name, profileImageId, socialLinks, ...text } =
    input;
  const author = await ctx.authors.get(authorId);

  const saved = await saveContent(ctx, {
    item: author,
    language,
    text: definedFields(text),
    shared: definedFields({ name, profileImageId, socialLinks }),
    // Neither field is required, so an existing language needs nothing carried over
    current: (code) =>
      author.locales.some((row) => row.languageCode === code) ? {} : undefined,
    requiredForNew: [],
    textDto: UpdateAuthorLocaleRequestDto,
    sharedDto: UpdateAuthorRequestDto,
    saveShared: (shared) => ctx.authors.update(ctx.user, authorId, shared),
    saveText: (code, fields, shared) =>
      ctx.authors.updateLocale(ctx.user, authorId, code, fields, {
        canonical: shared,
      }),
  });

  return savedOutcome(ctx, AUTHOR, await ctx.authors.get(authorId), saved);
}

export function registerAuthorTools(server: McpServer, ctx: McpContext) {
  server.registerTool(
    "list_authors",
    {
      title: "List authors",
      description:
        "Authors (post bylines) in a space, most recently edited first, with where every language of each profile stands.",
      inputSchema: listInput,
      annotations: READ_ONLY,
    },
    (input) => toolResult(() => listContent(ctx, AUTHOR, input)),
  );

  server.registerTool(
    "get_author",
    {
      title: "Read an author",
      description:
        "One author: their shared fields (name, profile picture, social links), their job title and bio in one language, that language's state, and every language they have.",
      inputSchema: z.object({
        authorId: authorIdInput,
        language: languageInput,
      }),
      annotations: READ_ONLY,
    },
    ({ authorId, language }) =>
      toolResult(() => readAuthor(ctx, authorId, language)),
  );

  server.registerTool(
    "create_author",
    {
      title: "Create an author",
      description:
        "A new draft author profile, with its job title and bio in the site's default language. Add translations with save_author.",
      inputSchema: z.object({
        spaceId: spaceIdInput,
        name: nameInput,
        jobTitle: authorText.jobTitle.optional(),
        bio: authorText.bio.optional(),
        profileImageId: z
          .string()
          .optional()
          .describe("An id from list_media."),
        socialLinks: socialLinksInput.optional(),
      }),
      annotations: SAVE,
    },
    (input) =>
      toolResult(async () => {
        const args = await validated(
          CreateAuthorRequestDto,
          definedFields(input),
        );
        const author = await ctx.authors.create(ctx.user, args);
        const { site } = await ctx.context.requireSpace(author.spaceId);
        return savedOutcome(ctx, AUTHOR, author, site.defaultLanguage);
      }),
  );

  server.registerTool(
    "save_author",
    {
      title: "Save an author",
      description:
        "Writes an author profile. Send only the fields to change; the rest stay as they are. Job title and bio are for one language, and naming a language the author does not have yet adds it. Fields marked Shared are the same in every language and are saved with the default language. Every save is a new version and never publishes.",
      inputSchema: saveInput,
      annotations: SAVE,
    },
    (input) => toolResult(() => saveAuthor(ctx, input)),
  );
}
