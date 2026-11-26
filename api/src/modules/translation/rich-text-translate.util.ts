import type { RichTextNode } from "../content/rich-text.util";

/**
 * Marks where one text node ends and the next begins inside a paragraph sent as one string. A tag,
 * so it is protected like any other and comes back where DeepL put it among the translated words.
 */
export const SEGMENT_SEPARATOR = "<bsep/>";

// The only blocks whose children are text; lists, tables and quotes are made of these
const TEXT_BLOCKS = new Set(["paragraph", "heading"]);

/**
 * Every paragraph and heading's text nodes, in document order. Each block is translated as one
 * string so DeepL sees whole sentences, with the boundaries between differently-marked runs kept as
 * separators — bold, links and inline embeds stay on the words they were on.
 */
export function textRuns(doc: RichTextNode): RichTextNode[][] {
  const runs: RichTextNode[][] = [];
  const visit = (node: RichTextNode) => {
    if (TEXT_BLOCKS.has(node.type)) {
      const texts = (node.content ?? []).filter(
        (child) => child.type === "text" && child.text,
      );
      if (texts.length) runs.push(texts);
      return;
    }
    for (const child of node.content ?? []) visit(child);
  };
  visit(doc);
  return runs;
}

/** The strings a document is translated as — one per paragraph or heading. */
export const runTexts = (runs: RichTextNode[][]) =>
  runs.map((texts) => texts.map((node) => node.text).join(SEGMENT_SEPARATOR));

/**
 * Writes translated strings back into a copy of the document. A paragraph whose separators did not
 * survive keeps the translation on its first run rather than scattering it, so no text is lost.
 */
export function withTranslatedRuns(
  doc: RichTextNode,
  translated: string[],
): RichTextNode {
  const copy = structuredClone(doc);
  textRuns(copy).forEach((texts, index) => {
    const parts = (translated[index] ?? "").split(SEGMENT_SEPARATOR);
    if (parts.length !== texts.length) {
      texts[0].text = parts.join("");
      for (const node of texts.slice(1)) node.text = "";
    } else
      texts.forEach((node, i) => {
        node.text = parts[i];
      });
  });
  return removeEmptyText(copy);
}

// A text node may not be empty in the schema, and a failed split above can leave some
function removeEmptyText(node: RichTextNode): RichTextNode {
  if (!node.content) return node;
  return {
    ...node,
    content: node.content
      .filter((child) => child.type !== "text" || Boolean(child.text))
      .map(removeEmptyText),
  };
}

/** Characters DeepL bills for this document: the text it is sent, separators aside. */
export const richTextCharacters = (doc: RichTextNode) =>
  textRuns(doc).reduce(
    (total, texts) =>
      total + texts.reduce((sum, node) => sum + (node.text?.length ?? 0), 0),
    0,
  );
