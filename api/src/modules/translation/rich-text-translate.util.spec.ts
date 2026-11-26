import { describe, expect, it } from "vitest";
import type { RichTextNode } from "../content/rich-text.util";
import {
  richTextCharacters,
  runTexts,
  SEGMENT_SEPARATOR,
  textRuns,
  withTranslatedRuns,
} from "./rich-text-translate.util";

const doc: RichTextNode = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Best knives" }],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Read the " },
        { type: "text", text: "guide", marks: [{ type: "bold" }] },
        { type: "entryInline", attrs: { entryType: "blog", entryId: "b1" } },
        { type: "text", text: " today." },
      ],
    },
    { type: "ctaEmbed", attrs: { ctaId: "cta-1" } },
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Chroma" }] },
          ],
        },
      ],
    },
  ],
};

describe("textRuns — translating a Tiptap body", () => {
  it("sends each paragraph and heading as one string, across lists", () => {
    expect(runTexts(textRuns(doc))).toEqual([
      "Best knives",
      `Read the ${SEGMENT_SEPARATOR}guide${SEGMENT_SEPARATOR} today.`,
      "Chroma",
    ]);
  });

  it("writes translations back onto the same runs, keeping marks and embeds", () => {
    const translated = withTranslatedRuns(doc, [
      "Beste Messer",
      `Lies den ${SEGMENT_SEPARATOR}Leitfaden${SEGMENT_SEPARATOR} heute.`,
      "Chroma",
    ]);
    const paragraph = translated.content?.[1];
    expect(paragraph?.content?.map((node) => node.text)).toEqual([
      "Lies den ",
      "Leitfaden",
      undefined,
      " heute.",
    ]);
    expect(paragraph?.content?.[1].marks).toEqual([{ type: "bold" }]);
    expect(paragraph?.content?.[2].type).toBe("entryInline");
    expect(translated.content?.[2]).toEqual(doc.content?.[2]);
    // The source is left alone
    expect(doc.content?.[0].content?.[0].text).toBe("Best knives");
  });

  it("keeps all the text when DeepL drops a separator", () => {
    const translated = withTranslatedRuns(doc, [
      "Beste Messer",
      "Lies heute den Leitfaden.",
      "Chroma",
    ]);
    const texts = translated.content?.[1].content
      ?.filter((node) => node.type === "text")
      .map((node) => node.text);
    expect(texts).toEqual(["Lies heute den Leitfaden."]);
  });

  it("counts the characters DeepL bills for", () => {
    expect(richTextCharacters(doc)).toBe(
      "Best knives".length + "Read the guide today.".length + "Chroma".length,
    );
  });
});
