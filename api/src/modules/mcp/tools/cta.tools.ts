import { CmsContentType, type Cta } from "@loom/database";
import {
  CreateCtaRequestDto,
  UpdateCtaLocaleRequestDto,
  UpdateCtaRequestDto,
} from "@loom/dto";
import {
  CTA_BUTTON_LABEL_MAX_LENGTH,
  CTA_CMPID_MAX_LENGTH,
  CTA_DESCRIPTION_MAX_LENGTH,
  CTA_TITLE_MAX_LENGTH,
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

const CTA = CmsContentType.CTA;

const ctaIdInput = z.string().describe("A CTA's id, from list_ctas or search.");

const urlInput = z
  .string()
  .describe(
    "Where the button goes, the same in every language: a relative /path, or an https URL on the site's own domain or a subdomain of it.",
  );

const cmpidInput = z
  .string()
  .max(CTA_CMPID_MAX_LENGTH)
  .describe(
    "Campaign id for tracking, the same in every language: lowercase letters, digits and single hyphens.",
  );

const ctaText = {
  title: z.string().max(CTA_TITLE_MAX_LENGTH),
  description: z
    .string()
    .max(CTA_DESCRIPTION_MAX_LENGTH)
    .describe('"" clears it.'),
  buttonLabel: z.string().max(CTA_BUTTON_LABEL_MAX_LENGTH),
};

const saveInput = z.object({
  ctaId: ctaIdInput,
  language: languageInput.describe(
    "Which language's text to write, as a code from list_sites. Defaults to the site's default language. A language the CTA does not have yet is added as a translation.",
  ),
  title: ctaText.title.optional(),
  description: ctaText.description.optional(),
  buttonLabel: ctaText.buttonLabel.optional(),
  url: urlInput.optional().describe(`Shared. ${urlInput.description}`),
  cmpid: cmpidInput
    .nullable()
    .optional()
    .describe(`Shared. ${cmpidInput.description} null removes it.`),
  imageId: pictureInput("Shared. The picture"),
});

async function readCta(
  ctx: McpContext,
  ctaId: Cta["id"],
  requested: string | undefined,
) {
  const cta = await ctx.ctas.get(ctaId);
  const { site } = await ctx.context.requireSpace(cta.spaceId);
  const language = languageOn(site, requested);
  const locale = cta.locales.find((row) => row.languageCode === language);

  return {
    id: cta.id,
    spaceId: cta.spaceId,
    language,
    defaultLanguage: site.defaultLanguage,
    inTrash: cta.deletedAt !== null,
    shared: {
      url: cta.url,
      cmpid: cta.cmpid,
      image: await pictureOf(ctx, cta.imageId),
    },
    text: locale
      ? {
          title: locale.title,
          description: locale.description,
          buttonLabel: locale.buttonLabel,
        }
      : null,
    state: localeState(cta.locales, language, site.defaultLanguage),
    languages: languageStates(cta.locales, site.defaultLanguage),
    editorPath: editorPath(CTA, cta.id),
  };
}

async function saveCta(ctx: McpContext, input: z.infer<typeof saveInput>) {
  const { ctaId, language, url, cmpid, imageId, ...text } = input;
  const cta = await ctx.ctas.get(ctaId);

  const saved = await saveContent(ctx, {
    item: cta,
    language,
    text: definedFields(text),
    shared: definedFields({ url, cmpid, imageId }),
    current: (code) => {
      const locale = cta.locales.find((row) => row.languageCode === code);
      return locale && { title: locale.title, buttonLabel: locale.buttonLabel };
    },
    requiredForNew: ["title", "buttonLabel"],
    textDto: UpdateCtaLocaleRequestDto,
    sharedDto: UpdateCtaRequestDto,
    saveShared: (shared) => ctx.ctas.update(ctx.user, ctaId, shared),
    saveText: (code, fields, shared) =>
      ctx.ctas.updateLocale(ctx.user, ctaId, code, fields, {
        canonical: shared,
      }),
  });

  return savedOutcome(ctx, CTA, await ctx.ctas.get(ctaId), saved);
}

export function registerCtaTools(server: McpServer, ctx: McpContext) {
  server.registerTool(
    "list_ctas",
    {
      title: "List CTAs",
      description:
        "Calls to action in a space, most recently edited first, with where every language of each stands. A post body places one with a ctaEmbed node.",
      inputSchema: listInput,
      annotations: READ_ONLY,
    },
    (input) => toolResult(() => listContent(ctx, CTA, input)),
  );

  server.registerTool(
    "get_cta",
    {
      title: "Read a CTA",
      description:
        "One call to action: its shared fields (URL, campaign id, picture), its text in one language (title, description, button label), that language's state, and every language it has.",
      inputSchema: z.object({ ctaId: ctaIdInput, language: languageInput }),
      annotations: READ_ONLY,
    },
    ({ ctaId, language }) => toolResult(() => readCta(ctx, ctaId, language)),
  );

  server.registerTool(
    "create_cta",
    {
      title: "Create a CTA",
      description:
        "A new draft call to action, with its text in the site's default language. Add translations with save_cta.",
      inputSchema: z.object({
        spaceId: spaceIdInput,
        title: ctaText.title,
        buttonLabel: ctaText.buttonLabel,
        url: urlInput,
        description: ctaText.description.optional(),
        cmpid: cmpidInput.optional(),
        imageId: z.string().optional().describe("An id from list_media."),
      }),
      annotations: SAVE,
    },
    (input) =>
      toolResult(async () => {
        const args = await validated(CreateCtaRequestDto, definedFields(input));
        const cta = await ctx.ctas.create(ctx.user, args);
        const { site } = await ctx.context.requireSpace(cta.spaceId);
        return savedOutcome(ctx, CTA, cta, site.defaultLanguage);
      }),
  );

  server.registerTool(
    "save_cta",
    {
      title: "Save a CTA",
      description:
        "Writes a call to action. Send only the fields to change; the rest stay as they are. Text fields are for one language, and naming a language the CTA does not have yet adds it. Fields marked Shared are the same in every language and are saved with the default language. Every save is a new version and never publishes.",
      inputSchema: saveInput,
      annotations: SAVE,
    },
    (input) => toolResult(() => saveCta(ctx, input)),
  );
}
