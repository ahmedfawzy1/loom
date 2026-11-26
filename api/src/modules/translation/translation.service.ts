import {
  type BlogLocale,
  CmsContentType,
  Prisma,
  type Site,
  type SiteLanguage,
} from "@loom/database";
import type {
  TranslateRequestDto,
  TranslationFieldsResponseDto,
  TranslationResultResponseDto,
  TranslationUsageResponseDto,
  UpdateAuthorLocaleRequestDto,
  UpdateBlogLocaleRequestDto,
  UpdateCategoryLocaleRequestDto,
  UpdateCtaLocaleRequestDto,
  UpdateTagLocaleRequestDto,
} from "@loom/dto";
import {
  CONTENT_TYPE_LABELS,
  FAQ_ANSWER_MAX_LENGTH,
  FAQ_QUESTION_MAX_LENGTH,
  translationState,
} from "@loom/dto/constants";
import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/auth.types";
import { AuthorService } from "../author/author.service";
import { BlogService } from "../blog/blog.service";
import { CategoryService } from "../category/category.service";
import { ContentContextService } from "../content/content-context.service";
import {
  assertNotTrashed,
  type CanonicalRow,
  type LocaleRow,
  type LocaleSaveOptions,
  localeDelegate,
  requireItem,
} from "../content/content-item.util";
import {
  contentKind,
  type TranslatedField,
  type TranslationSpec,
} from "../content/content-kind.registry";
import type { RichTextNode } from "../content/rich-text.util";
import type { SnapshotProvenance } from "../content/snapshot.util";
import { fingerprint } from "../content/stable-json.util";
import {
  type Baseline,
  entryOf,
  targetPrint,
} from "../content/translation-baseline.util";
import { CtaService } from "../cta/cta.service";
import { PrismaService } from "../prisma/prisma.service";
import { TagService } from "../tag/tag.service";
import {
  type DeeplMeter,
  DeeplService,
  type DeeplTarget,
} from "./deepl.service";
import {
  runTexts,
  textRuns,
  withTranslatedRuns,
} from "./rich-text-translate.util";
import { TRANSLATE_CONCURRENCY } from "./translation.constants";
import { slugifyTranslation } from "./translation-text.util";

/** A locale row with its fields readable by name — what the spec addresses. */
type LocaleFields = LocaleRow & Record<string, unknown>;

interface FaqItem {
  question: string;
  answer: string;
}

/** Saves one language through its type's own path, so it is validated and versioned like any save. */
type SaveLocale = (
  actor: AuthenticatedUser,
  id: CanonicalRow["id"],
  languageCode: SiteLanguage["code"],
  values: Record<string, unknown>,
  options: LocaleSaveOptions<never>,
) => Promise<unknown>;

/** One short string going to DeepL, and the cap it has to fit if it has one. */
interface ShortText {
  text: string;
  maxLength?: number;
  apply: (translated: string) => void;
}

interface LanguageJob {
  type: CmsContentType;
  itemId: CanonicalRow["id"];
  site: Site;
  source: LocaleFields;
  existing: LocaleFields | undefined;
  language: SiteLanguage;
  retranslate: boolean;
  /** Fields to send again even where a person edited them. */
  fields: ReadonlySet<string>;
}

const isBlank = (value: unknown) =>
  value === null ||
  value === undefined ||
  (typeof value === "string" && !value.trim()) ||
  (Array.isArray(value) && value.length === 0);

/** Runs `task` over `items`, `limit` at a time, keeping the results in the items' order. */
async function mapConcurrent<T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return results;
}

@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name);
  private readonly savers: Partial<Record<CmsContentType, SaveLocale>>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly context: ContentContextService,
    private readonly deepl: DeeplService,
    blogService: BlogService,
    categoryService: CategoryService,
    tagService: TagService,
    authorService: AuthorService,
    ctaService: CtaService,
  ) {
    // Each type's own save, typed at its own DTO: the values are built from its translation spec
    this.savers = {
      [CmsContentType.BLOG]: (actor, id, language, values, options) =>
        blogService.updateLocale(
          actor,
          id,
          language,
          values as unknown as UpdateBlogLocaleRequestDto,
          options,
        ),
      [CmsContentType.CATEGORY]: (actor, id, language, values, options) =>
        categoryService.updateLocale(
          actor,
          id,
          language,
          values as unknown as UpdateCategoryLocaleRequestDto,
          options,
        ),
      [CmsContentType.TAG]: (actor, id, language, values, options) =>
        tagService.updateLocale(
          actor,
          id,
          language,
          values as unknown as UpdateTagLocaleRequestDto,
          options,
        ),
      [CmsContentType.AUTHOR]: (actor, id, language, values, options) =>
        authorService.updateLocale(
          actor,
          id,
          language,
          values as unknown as UpdateAuthorLocaleRequestDto,
          options,
        ),
      [CmsContentType.CTA]: (actor, id, language, values, options) =>
        ctaService.updateLocale(
          actor,
          id,
          language,
          values as unknown as UpdateCtaLocaleRequestDto,
          options,
        ),
    };
  }

  /**
   * Translates an item from its default language into others — manually only, never on a source
   * edit. A new language lands in Draft; an existing one is saved like any edit, so a
   * live translation becomes Changed and keeps serving until it is published. Each language
   * succeeds or fails on its own, so one refusal does not cost the DeepL work already done.
   */
  async translate(
    actor: AuthenticatedUser,
    type: CmsContentType,
    itemId: CanonicalRow["id"],
    args: TranslateRequestDto,
  ): Promise<TranslationResultResponseDto[]> {
    if (!args.languages?.length && !args.missing && !args.stale)
      throw new BadRequestException(
        "Choose the languages to translate into, or ask for every missing or stale one",
      );
    const { spec, save, site, locales, source } = await this.load(type, itemId);
    this.deepl.assertConfigured();

    const targets = this.targetLanguages(site, locales, args);
    return mapConcurrent(targets, TRANSLATE_CONCURRENCY, (language) =>
      this.translateLanguage(actor, spec, save, {
        type,
        itemId,
        site,
        source,
        existing: locales.find(
          (locale) => locale.languageCode === language.code,
        ),
        language,
        retranslate: Boolean(args.retranslate),
        fields: new Set(args.fields),
      }),
    );
  }

  /**
   * Which fields of each translation are behind its source, by the same rules a translate applies —
   * so what the editor shows as out of date is exactly what translating would update or keep.
   */
  async fieldStates(
    type: CmsContentType,
    itemId: CanonicalRow["id"],
  ): Promise<TranslationFieldsResponseDto[]> {
    const { spec, site, locales, source } = await this.load(type, itemId);
    return locales
      .filter((locale) => locale.languageCode !== site.defaultLanguage)
      .map((locale) => {
        const baseline = (locale.sourceBaseline ?? null) as Record<
          string,
          unknown
        > | null;
        const fields: TranslationFieldsResponseDto["fields"] = [];
        for (const field of spec.translated) {
          const value = source[field.name];
          const entry = entryOf(baseline?.[field.name]);
          if (entry?.source === fingerprint(value)) continue;
          if (isBlank(value)) {
            // The source removed it: an update clears the machine's copy and leaves a person's alone
            if (
              entry &&
              !isBlank(locale[field.name]) &&
              entry.target === targetPrint(field.kind, locale[field.name])
            )
              fields.push({ name: field.name, state: "changed" });
            continue;
          }
          if (!entry) {
            // With no baseline a translate fills a blank and leaves a filled one as the person's
            fields.push({
              name: field.name,
              state: isBlank(locale[field.name]) ? "changed" : "untracked",
            });
            continue;
          }
          fields.push({
            name: field.name,
            state:
              entry.target === targetPrint(field.kind, locale[field.name])
                ? "changed"
                : "edited",
          });
        }
        // Copied fields move the source's revision too, and a translate carries them over as they are
        for (const field of spec.copied)
          if (fingerprint(locale[field]) !== fingerprint(source[field]))
            fields.push({ name: field, state: "copied" });
        return { languageCode: locale.languageCode, fields };
      });
  }

  /**
   * Records that a language already says what the current source says — a translator updated it by
   * hand. It stops being Stale, and every field gets a baseline, so a later translate knows which
   * fields have changed since and leaves the rest of the hand translation alone.
   */
  async markCurrent(
    actor: AuthenticatedUser,
    type: CmsContentType,
    itemId: CanonicalRow["id"],
    languageCode: SiteLanguage["code"],
  ): Promise<void> {
    const { spec, save, site, locales, source } = await this.load(type, itemId);
    if (languageCode === site.defaultLanguage)
      throw new BadRequestException(
        `${languageCode} is the source language — there is nothing to compare it with`,
      );
    const existing = locales.find(
      (locale) => locale.languageCode === languageCode,
    );
    if (!existing)
      throw new NotFoundException(`There is no ${languageCode} version yet`);

    const values = this.currentValues(spec, existing);
    for (const field of spec.copied) values[field] = source[field];
    const previous = existing.sourceBaseline as Record<string, unknown> | null;

    // A field still holding exactly what the machine wrote stays the machine's to update; any other
    // is a person's, which a translate will not overwrite
    const sourceBaseline: Baseline = {};
    for (const field of spec.translated) {
      const target = targetPrint(field.kind, existing[field.name]);
      sourceBaseline[field.name] = {
        source: fingerprint(source[field.name]),
        target:
          entryOf(previous?.[field.name])?.target === target ? target : null,
      };
    }

    await save(actor, itemId, languageCode, values, {
      confirmedAgainst: source.contentRevision,
      provenance: {
        sourceRevision: source.contentRevision,
        sourceBaseline: sourceBaseline as unknown as Prisma.JsonObject,
      },
    });
  }

  /** Characters this Site has sent to DeepL since the start of the month, in UTC. */
  async usage(siteId: Site["id"]): Promise<TranslationUsageResponseDto> {
    const site = await this.prisma.site.findUnique({ where: { id: siteId } });
    if (!site) throw new NotFoundException(`Site ${siteId} not found`);

    const now = new Date();
    const since = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const { _sum } = await this.prisma.translationUsage.aggregate({
      where: { siteId, createdAt: { gte: since } },
      _sum: { characters: true },
    });
    return { characters: _sum.characters ?? 0, since };
  }

  private async load(type: CmsContentType, itemId: CanonicalRow["id"]) {
    const spec = contentKind(type).translation;
    const save = this.savers[type];
    if (!spec || !save)
      throw new BadRequestException(
        `${CONTENT_TYPE_LABELS[type]} has no text to translate — each language keeps its own`,
      );

    const item = await requireItem(this.prisma, type, itemId);
    assertNotTrashed(item, type);
    const { site } = await this.context.requireSpace(item.spaceId);

    const locales = (await localeDelegate(this.prisma, type).findMany({
      where: { [contentKind(type).localeForeignKey]: itemId },
    })) as LocaleFields[];
    const source = locales.find(
      (locale) => locale.languageCode === site.defaultLanguage,
    );
    if (!source)
      throw new ConflictException(
        `There is no ${site.defaultLanguage} version to translate from yet`,
      );
    return { spec, save, site, locales, source };
  }

  private targetLanguages(
    site: Site & { languages: SiteLanguage[] },
    locales: LocaleFields[],
    args: TranslateRequestDto,
  ): SiteLanguage[] {
    const candidates = site.languages
      .filter(
        (language) =>
          language.enabled && language.code !== site.defaultLanguage,
      )
      .sort((a, b) => a.position - b.position);

    if (args.missing)
      return candidates.filter(
        (language) =>
          !locales.some((locale) => locale.languageCode === language.code),
      );

    if (args.stale) {
      const source = locales.find(
        (locale) => locale.languageCode === site.defaultLanguage,
      );
      return candidates.filter((language) => {
        const locale = locales.find(
          (candidate) => candidate.languageCode === language.code,
        );
        return locale && translationState(locale, source) === "stale";
      });
    }

    const requested = new Set(args.languages);
    const unknown = [...requested].filter(
      (code) => !candidates.some((language) => language.code === code),
    );
    if (unknown.length)
      throw new BadRequestException(
        `Not a translatable language on ${site.name}: ${unknown.join(", ")}`,
      );
    return candidates.filter((language) => requested.has(language.code));
  }

  /**
   * One language, never throwing: a failure becomes that language's result. Usage is written in
   * `finally` from the meter DeepL itself kept, so work that was billed is counted even when a later
   * request or the save fails.
   */
  private async translateLanguage(
    actor: AuthenticatedUser,
    spec: TranslationSpec,
    save: SaveLocale,
    job: LanguageJob,
  ): Promise<TranslationResultResponseDto> {
    const { source, existing, language } = job;
    const meter: DeeplMeter = { characters: 0 };

    try {
      if (!language.deeplCode)
        throw new BadRequestException(
          `DeepL has no code configured for ${language.label}`,
        );

      const upToDate =
        existing?.sourceRevision != null &&
        existing.sourceRevision >= source.contentRevision;
      if (upToDate && !job.retranslate)
        return {
          languageCode: language.code,
          outcome: "unchanged",
          characters: 0,
          message: null,
        };

      const { save: toSave, kept } = await this.translateFields(
        spec,
        job,
        {
          language: language.deeplCode,
          protectedTerms: job.site.protectedTerms,
        },
        meter,
      );
      // Named, since it leaves the language Stale: the person who kept them decides what happens
      const keptNote = kept.length
        ? `Kept the hand-written ${kept.join(", ")} — retranslate to replace, or edit and mark it up to date`
        : null;
      if (!toSave)
        return {
          languageCode: language.code,
          outcome: "unchanged",
          characters: 0,
          message:
            keptNote ??
            "Nothing blank to fill, and the rest was written by hand — retranslate to replace it, or mark it up to date",
        };
      await save(actor, job.itemId, language.code, toSave.values, {
        translatedFrom: source.contentRevision,
        provenance: toSave.provenance,
      });

      return {
        languageCode: language.code,
        outcome: "translated",
        characters: meter.characters,
        message: keptNote,
      };
    } catch (error) {
      return {
        languageCode: language.code,
        outcome: "failed",
        characters: meter.characters,
        message: this.describeFailure(error),
      };
    } finally {
      if (meter.characters)
        await this.prisma.translationUsage.create({
          data: {
            siteId: job.site.id,
            languageCode: language.code,
            contentType: job.type,
            contentId: job.itemId,
            characters: meter.characters,
            userId: actor.id,
          },
        });
    }
  }

  /**
   * What to save for one language, and which fields it kept because a person wrote them.
   *
   * Which fields are sent comes from the language's own baseline (see BaselineEntry), not from the
   * source's history, so a clone, a duplicate or an import that carries the language carries the
   * answer too. A field is sent again only when its source changed and it still holds exactly
   * what the machine wrote; one a person wrote or edited since is kept, and one with no baseline is
   * only filled when blank. `retranslate` sends everything. The language counts as current only once
   * every field it has is accounted for; otherwise it keeps whatever it claimed before.
   *
   * Every short field and FAQ entry goes to DeepL in one request; only the results that overrun
   * their cap go back one at a time to be fitted. `save` is absent when it would record nothing: no
   * field to send, no copied field to bring over, and the language no more current than before.
   */
  private async translateFields(
    spec: TranslationSpec,
    job: LanguageJob,
    target: DeeplTarget,
    meter: DeeplMeter,
  ): Promise<{
    save?: { values: Record<string, unknown>; provenance: SnapshotProvenance };
    kept: TranslatedField["label"][];
  }> {
    const { source, existing, site } = job;
    const previous = (existing?.sourceBaseline ?? null) as Record<
      string,
      unknown
    > | null;
    const baseline: Baseline = {};
    if (!job.retranslate)
      for (const field of spec.translated) {
        const entry = entryOf(previous?.[field.name]);
        if (entry) baseline[field.name] = entry;
      }
    const values: Record<string, unknown> = existing
      ? this.currentValues(spec, existing)
      : {};

    const short: ShortText[] = [];
    let body: { name: string; doc: RichTextNode } | undefined;
    const sent: TranslatedField[] = [];
    const kept: TranslatedField["label"][] = [];

    for (const field of spec.translated) {
      const value = source[field.name];
      const print = fingerprint(value);
      const entry = baseline[field.name];
      let send = !existing || job.retranslate || job.fields.has(field.name);
      if (!send && existing && entry && entry.source !== print) {
        send = entry.target === targetPrint(field.kind, existing[field.name]);
        if (!send) kept.push(field.label);
      } else if (!send && existing && !entry)
        send = isBlank(existing[field.name]) && !isBlank(value);
      if (!send) continue;

      sent.push(field);
      baseline[field.name] = { source: print, target: null };
      if (isBlank(value)) {
        values[field.name] = field.kind === "faq" ? [] : null;
        continue;
      }
      if (field.kind === "richText") {
        body = { name: field.name, doc: value as RichTextNode };
        continue;
      }
      if (field.kind === "faq") {
        const items = (value as FaqItem[]).map((item) => ({ ...item }));
        values[field.name] = items;
        for (const item of items) {
          short.push({
            text: item.question,
            maxLength: FAQ_QUESTION_MAX_LENGTH,
            apply: (translated) => (item.question = translated),
          });
          short.push({
            text: item.answer,
            maxLength: FAQ_ANSWER_MAX_LENGTH,
            apply: (translated) => (item.answer = translated),
          });
        }
        continue;
      }
      short.push({
        text: String(value),
        maxLength: field.maxLength,
        apply: (translated) => (values[field.name] = translated),
      });
    }

    const current = spec.translated.every(
      (field) =>
        isBlank(source[field.name]) ||
        baseline[field.name]?.source === fingerprint(source[field.name]),
    );
    const copiedChanged = spec.copied.some(
      (field) => fingerprint(existing?.[field]) !== fingerprint(source[field]),
    );
    if (existing && !sent.length && !current && !copiedChanged) return { kept };

    for (const field of spec.copied) values[field] = source[field];

    // Translated once, when the language is made; after that a slug is a URL people link to
    let slug: string | undefined;
    if (spec.translatesSlug && !existing)
      short.push({
        text: String(source.slug).replace(/-/g, " "),
        apply: (translated) => (slug = translated),
      });

    const context = `Text from a ${CONTENT_TYPE_LABELS[job.type].toLowerCase()} on ${site.name}.`;
    const translated = await this.deepl.translate(
      short.map((entry) => entry.text),
      target,
      context,
      meter,
    );
    for (const [index, entry] of short.entries()) {
      let text = translated[index] ?? "";
      if (entry.maxLength && text.length > entry.maxLength)
        text = await this.deepl.translateToFit(
          entry.text,
          target,
          context,
          entry.maxLength,
          meter,
        );
      entry.apply(text);
    }

    if (body) {
      const runs = textRuns(body.doc);
      values[body.name] = withTranslatedRuns(
        body.doc,
        await this.deepl.translate(runTexts(runs), target, context, meter),
      );
    }

    // What the machine wrote, so a later hand edit to it can be told apart
    for (const field of sent)
      baseline[field.name].target = targetPrint(field.kind, values[field.name]);

    if (spec.translatesSlug)
      values.slug = existing
        ? existing.slug
        : await this.freeBlogSlug(
            slugifyTranslation(slug ?? "") || String(source.slug),
            source.spaceId,
            job.language.code,
            String(source.blogId),
          );

    return {
      kept,
      save: {
        values,
        provenance: {
          sourceRevision: current
            ? source.contentRevision
            : (existing?.sourceRevision ?? null),
          sourceBaseline: baseline as unknown as Prisma.JsonObject,
        },
      },
    };
  }

  /** The language's own values for every field the spec saves, as they stand now. */
  private currentValues(spec: TranslationSpec, locale: LocaleFields) {
    const values: Record<string, unknown> = {};
    for (const field of spec.translated)
      values[field.name] = locale[field.name];
    for (const field of spec.copied) values[field] = locale[field];
    if (spec.translatesSlug) values.slug = locale.slug;
    return values;
  }

  /** A translated slug can collide with another post's in that language; a number keeps it apart. */
  private async freeBlogSlug(
    slug: BlogLocale["slug"],
    spaceId: BlogLocale["spaceId"],
    languageCode: BlogLocale["languageCode"],
    blogId: BlogLocale["blogId"],
  ): Promise<BlogLocale["slug"]> {
    for (let attempt = 1; ; attempt++) {
      const candidate = attempt === 1 ? slug : `${slug}-${attempt}`;
      const holder = await this.prisma.blogLocale.findFirst({
        where: { spaceId, languageCode, slug: candidate },
      });
      if (!holder || holder.blogId === blogId) return candidate;
    }
  }

  private describeFailure(error: unknown): string {
    if (error instanceof HttpException) {
      const body = error.getResponse();
      const message =
        typeof body === "object" && body && "message" in body
          ? (body as { message: unknown }).message
          : error.message;
      return Array.isArray(message) ? message.join("; ") : String(message);
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      return "Another item in this language already uses one of the translated values, such as its slug or SEO title — edit it by hand";

    this.logger.error(error instanceof Error ? error.stack : String(error));
    return "The translation could not be saved";
  }
}
