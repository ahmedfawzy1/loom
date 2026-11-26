import type { Site, SiteLanguage } from "@loom/database";
import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  CUSTOM_INSTRUCTION_LANGUAGES,
  DEEPL_BATCH_SIZE,
  DEEPL_KEY_PLACEHOLDER,
  DEEPL_REQUEST_TIMEOUT_MS,
  DEEPL_RETRY,
  MAX_CONSTRAINED_ATTEMPTS,
} from "./translation.constants";
import { protectText, restoreText, truncateAt } from "./translation-text.util";

type DeeplCode = NonNullable<SiteLanguage["deeplCode"]>;

/** What every request needs besides the text: where it goes and what must survive it. */
export interface DeeplTarget {
  language: DeeplCode;
  protectedTerms: Site["protectedTerms"];
}

/**
 * Characters DeepL has been sent and has answered — what it bills. Counted per request here, not
 * per field by the caller, so a length-capped field sent three times counts three times.
 */
export interface DeeplMeter {
  characters: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

class RetryableError extends Error {}

/**
 * DeepL's `/v2/translate`: the host follows from the key,
 * transient failures are retried with backoff, and protected text is tokenised on the way in and
 * restored on the way out.
 */
@Injectable()
export class DeeplService {
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string | undefined;

  constructor(configService: ConfigService) {
    this.apiKey = configService.get<string>("DEEPL_API_KEY");
    // Free-tier keys end in ":fx" and only work against api-free; the wrong host answers 403.
    // DEEPL_API_URL overrides both — a proxy, or a stand-in for local testing.
    this.baseUrl =
      configService.get<string>("DEEPL_API_URL") ??
      (this.apiKey?.endsWith(":fx")
        ? "https://api-free.deepl.com"
        : "https://api.deepl.com");
  }

  /** Refuses up front rather than failing every language one by one at DeepL. */
  assertConfigured() {
    if (!this.apiKey || this.apiKey === DEEPL_KEY_PLACEHOLDER)
      throw new ServiceUnavailableException(
        "DeepL is not configured — set DEEPL_API_KEY on the CMS API",
      );
  }

  /** Translates texts in order, in batches; empty ones come back empty without being sent. */
  async translate(
    texts: string[],
    target: DeeplTarget,
    context: string,
    meter: DeeplMeter,
  ): Promise<string[]> {
    const results = [...texts];
    const pending = texts
      .map((text, index) => ({ text, index }))
      .filter(({ text }) => text.trim());

    for (let i = 0; i < pending.length; i += DEEPL_BATCH_SIZE) {
      const batch = pending.slice(i, i + DEEPL_BATCH_SIZE);
      const protectedTexts = batch.map(({ text }) =>
        protectText(text, target.protectedTerms),
      );
      const translations = await this.request(
        {
          text: protectedTexts.map((item) => item.text),
          target_lang: target.language,
          context,
        },
        meter,
      );
      if (translations.length !== batch.length)
        throw new BadGatewayException(
          `DeepL returned ${translations.length} translations for ${batch.length} texts`,
        );
      batch.forEach(({ index }, j) => {
        results[index] = restoreText(translations[j], protectedTexts[j].tokens);
      });
    }
    return results;
  }

  /**
   * One text that must fit `maxLength` — the save that follows would refuse anything longer. DeepL
   * is asked for it, and where it supports instructions told again more firmly; if it still runs
   * over, the source is shortened by the expansion this language actually showed and translated
   * again, and the result is cut at a word boundary as a last resort.
   */
  async translateToFit(
    text: string,
    target: DeeplTarget,
    context: string,
    maxLength: number,
    meter: DeeplMeter,
  ): Promise<string> {
    if (!text.trim()) return text;
    const canInstruct = CUSTOM_INSTRUCTION_LANGUAGES.has(
      target.language.split("-")[0] ?? "",
    );
    let expansion = 1.3;
    let closest = "";

    for (let attempt = 0; attempt < MAX_CONSTRAINED_ATTEMPTS; attempt++) {
      const { text: protectedText, tokens } = protectText(
        text,
        target.protectedTerms,
      );
      const [raw] = await this.request(
        {
          text: [protectedText],
          target_lang: target.language,
          context: `${context} Maximum ${maxLength} characters.`,
          ...(canInstruct
            ? {
                custom_instructions: [
                  `The translation must be at most ${maxLength} characters.`,
                  "Use concise, natural phrasing.",
                  "Preserve placeholders exactly.",
                  ...(attempt > 0
                    ? [
                        "The previous attempt was too long. Use fewer words and shorter synonyms.",
                      ]
                    : []),
                ],
              }
            : {}),
        },
        meter,
      );
      const translated = restoreText(raw ?? "", tokens);
      if (translated.length <= maxLength) return translated;
      expansion = translated.length / text.length;
      closest = translated;
      if (!canInstruct) break;
    }

    const budget = Math.max(Math.floor((maxLength / expansion) * 0.95), 20);
    const [shorter] = await this.translate(
      [truncateAt(text, budget)],
      target,
      context,
      meter,
    );
    return truncateAt(shorter || closest, maxLength);
  }

  private async request(
    payload: { text: string[] } & Record<string, unknown>,
    meter: DeeplMeter,
  ): Promise<string[]> {
    this.assertConfigured();
    for (let attempt = 0; ; attempt++) {
      try {
        const translations = await this.send(payload);
        // Counted once answered: a request refused with a 429 or a 5xx is retried, not billed
        meter.characters += payload.text.reduce(
          (sum, text) => sum + text.length,
          0,
        );
        return translations;
      } catch (error) {
        if (
          !(error instanceof RetryableError) ||
          attempt >= DEEPL_RETRY.maxRetries
        )
          throw error instanceof RetryableError
            ? new BadGatewayException(error.message)
            : error;
        await sleep(
          Math.min(
            DEEPL_RETRY.baseDelayMs * DEEPL_RETRY.backoffMultiplier ** attempt,
            DEEPL_RETRY.maxDelayMs,
          ),
        );
      }
    }
  }

  private async send(payload: Record<string, unknown>): Promise<string[]> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/v2/translate`, {
        method: "POST",
        headers: {
          Authorization: `DeepL-Auth-Key ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source_lang: "EN",
          preserve_formatting: true,
          split_sentences: "nonewlines",
          ...payload,
        }),
        signal: AbortSignal.timeout(DEEPL_REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new RetryableError(
        `DeepL could not be reached: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (response.status === 429 || response.status >= 500)
      throw new RetryableError(`DeepL answered ${response.status}`);
    if (!response.ok)
      throw new BadGatewayException(
        `DeepL refused the request (${response.status}): ${await response.text()}`,
      );

    const data = (await response.json()) as {
      translations?: { text?: string }[];
    };
    return (data.translations ?? []).map((item) => String(item.text ?? ""));
  }
}
