// Texts per DeepL request; its limit is 50, and a post body runs to hundreds of paragraphs
export const DEEPL_BATCH_SIZE = 40;

export const DEEPL_RETRY = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 15_000,
  backoffMultiplier: 2,
};

export const DEEPL_REQUEST_TIMEOUT_MS = 30_000;

// A length-capped field is retried this many times, asking for shorter, before its source is cut
export const MAX_CONSTRAINED_ATTEMPTS = 3;

// DeepL accepts custom instructions only for these target languages
export const CUSTOM_INSTRUCTION_LANGUAGES = new Set(["DE", "ES", "FR"]);

// A key still set to the .env.example placeholder, which would otherwise fail at DeepL as a 403
export const DEEPL_KEY_PLACEHOLDER = "REPLACE_ME";

// Languages translated at once. DeepL takes concurrent requests from one key; this keeps a full
// "all missing" run inside a proxy's request timeout without inviting 429s
export const TRANSLATE_CONCURRENCY = 4;
