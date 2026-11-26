import { describe, expect, it } from "vitest";
import {
  protectText,
  restoreText,
  slugifyTranslation,
  truncateAt,
} from "./translation-text.util";

const TERMS = ["Acme", "Widget", "Widget Pro", "Globex"];

describe("protectText — plan §8 protected terms", () => {
  it("hides every protected term from DeepL and puts it back", () => {
    const source = "Trade Widget items on Acme, the Globex market.";
    const { text, tokens } = protectText(source, TERMS);
    for (const term of ["Widget", "Acme", "Globex"])
      expect(text).not.toContain(term);
    expect(restoreText(text, tokens)).toBe(source);
  });

  it("protects the longest term whole", () => {
    const { tokens } = protectText("A Widget Pro gadget", TERMS);
    expect(tokens.map((token) => token.value)).toContain("Widget Pro");
  });

  // "Globex" inside "Globexian" is a different word, which DeepL may translate
  it("matches whole words only", () => {
    const { text } = protectText("Globexian players", TERMS);
    expect(text).toBe("Globexian players");
  });

  it("still protects placeholders, tags and line breaks", () => {
    const source = "Hello {name}\n<b>there</b>";
    const { text, tokens } = protectText(source, []);
    expect(text).not.toMatch(/[{}<>\n]/);
    expect(restoreText(text, tokens)).toBe(source);
  });

  it("survives DeepL moving tokens around the translated words", () => {
    const { text, tokens } = protectText("Acme is great", TERMS);
    const translated = `Super ist ${text.slice(0, text.indexOf("]]]") + 3)}`;
    expect(restoreText(translated, tokens)).toBe("Super ist Acme");
  });
});

describe("truncateAt", () => {
  it("cuts at a word boundary and drops trailing punctuation", () => {
    expect(truncateAt("alpha beta gamma delta", 20)).toBe("alpha beta gamma");
    expect(truncateAt("alpha beta, gamma", 12)).toBe("alpha beta");
    expect(truncateAt("short", 12)).toBe("short");
  });
});

describe("slugifyTranslation", () => {
  it("drops Latin accents", () => {
    expect(slugifyTranslation("Élite Messer Führer")).toBe(
      "elite-messer-fuhrer",
    );
  });

  // A Devanagari vowel sign is a combining mark; treating it as punctuation splits the word
  it("keeps other scripts, combining marks included", () => {
    expect(slugifyTranslation("सबसे अच्छा चाकू")).toBe("सबसे-अच्छा-चाकू");
    expect(slugifyTranslation("最高のナイフ")).toBe("最高のナイフ");
  });

  it("fits the slug length at a dash", () => {
    const slug = slugifyTranslation("word ".repeat(20));
    expect(slug.length).toBeLessThanOrEqual(50);
    expect(slug.endsWith("-")).toBe(false);
  });
});
