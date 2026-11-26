import type { Site } from "@loom/database";
import { SLUG_MAX_LENGTH } from "@loom/dto/constants";

/** A piece of source text DeepL must return untouched, swapped out for a token while it translates. */
interface ProtectedToken {
  id: string;
  value: string;
}

export interface ProtectedText {
  text: string;
  tokens: ProtectedToken[];
}

/** `{…}` groups, balanced, so an ICU plural block is protected whole. */
function curlySegments(text: string) {
  const segments: { start: number; end: number }[] = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (text[i] === "}" && depth > 0) {
      depth--;
      if (depth === 0 && start >= 0) {
        segments.push({ start, end: i + 1 });
        start = -1;
      }
    }
  }
  return segments;
}

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Swaps everything DeepL must not change for tokens: placeholders, tags, line breaks — and the
 * Site's protected terms. Asking DeepL in the context to leave brand names alone is a
 * request; replacing them with tokens it cannot read is a guarantee.
 */
export function protectText(
  text: string,
  protectedTerms: Site["protectedTerms"] = [],
): ProtectedText {
  const tokens: ProtectedToken[] = [];
  const toToken = (value: string) => {
    const id = `[[[P${tokens.length}]]]`;
    tokens.push({ id, value });
    return id;
  };

  let output = text;
  for (const segment of curlySegments(output).sort((a, b) => b.start - a.start))
    output = `${output.slice(0, segment.start)}${toToken(output.slice(segment.start, segment.end))}${output.slice(segment.end)}`;

  output = output.replace(/<[^>]+>/g, (match) => toToken(match));

  // Longest first, so "MM2 Godly" wins over "MM2"; whole words only, in any script
  const terms = [...protectedTerms]
    .filter((term) => term.trim())
    .sort((a, b) => b.length - a.length);
  if (terms.length)
    output = output.replace(
      new RegExp(
        `(?<![\\p{L}\\p{N}])(?:${terms.map(escapeRegExp).join("|")})(?![\\p{L}\\p{N}])`,
        "gu",
      ),
      (match) => toToken(match),
    );

  output = output.replace(/\n/g, () => toToken("\n"));
  return { text: output, tokens };
}

export function restoreText(text: string, tokens: ProtectedToken[]): string {
  let output = text.replace(/\r\n/g, "\n");
  for (const token of tokens) output = output.replaceAll(token.id, token.value);
  return output;
}

/** Cut to the last word boundary that fits, so a hard limit never lands mid-word. */
export function truncateAt(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const clipped = text.slice(0, maxLength);
  const lastSpace = clipped.lastIndexOf(" ");
  const cut =
    lastSpace > maxLength * 0.6 ? clipped.slice(0, lastSpace) : clipped;
  return cut.replace(/[\s,;:.\-–—]+$/, "");
}

/**
 * A slug from translated words, in any script: Latin accents are dropped (`é` → `e`), but letters,
 * numbers and combining marks of every other script are kept — a Hindi vowel sign is part of the
 * word, and stripping it as punctuation would spell something else. Cut at a dash to fit.
 */
export function slugifyTranslation(text: string): string {
  const slug = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  if (slug.length <= SLUG_MAX_LENGTH) return slug;
  const clipped = slug.slice(0, SLUG_MAX_LENGTH);
  const lastDash = clipped.lastIndexOf("-");
  return (lastDash > 0 ? clipped.slice(0, lastDash) : clipped).replace(
    /-+$/,
    "",
  );
}
