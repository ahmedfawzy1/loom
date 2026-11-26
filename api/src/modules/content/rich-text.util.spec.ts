import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { EMPTY_DOCUMENT } from "../blog/blog.constants";
import {
  collectReferences,
  parseDocument,
  type RichTextNode,
  remapReferences,
} from "./rich-text.util";

const paragraph = (
  text: string,
  marks?: RichTextNode["marks"],
): RichTextNode => ({
  type: "paragraph",
  content: [{ type: "text", text, ...(marks ? { marks } : {}) }],
});

const doc = (...content: RichTextNode[]): RichTextNode => ({
  type: "doc",
  content,
});

/** A body exercising every reference kind the contract allows. */
const REFERENCING = doc(
  {
    type: "heading",
    attrs: { level: 2 },
    content: [{ type: "text", text: "Best knives" }],
  },
  paragraph("Read the ", [{ type: "bold" }]),
  paragraph("guide", [
    { type: "entryLink", attrs: { entryType: "blog", entryId: "blog-1" } },
  ]),
  { type: "ctaEmbed", attrs: { ctaId: "cta-1" } },
  { type: "mediaEmbed", attrs: { mediaId: "media-1" } },
  { type: "entryEmbed", attrs: { entryType: "category", entryId: "cat-1" } },
  paragraph("see the image", [
    { type: "assetLink", attrs: { mediaId: "media-2" } },
  ]),
);

describe("parseDocument — plan §17", () => {
  it("accepts a document using every supported construct", () => {
    expect(() => parseDocument(REFERENCING)).not.toThrow();
  });

  it("accepts the empty document a new post starts with", () => {
    expect(() => parseDocument(EMPTY_DOCUMENT)).not.toThrow();
  });

  // A document needs at least one block; this is what the editor itself holds when empty
  it("refuses a document with no blocks at all", () => {
    expect(() => parseDocument({ type: "doc", content: [] })).toThrow(
      BadRequestException,
    );
  });

  it("rejects anything that is not a document at the root", () => {
    expect(() => parseDocument(paragraph("x"))).toThrow(BadRequestException);
    expect(() => parseDocument("<p>html</p>")).toThrow(BadRequestException);
    expect(() => parseDocument(null)).toThrow(BadRequestException);
  });

  it("rejects a node type there is no renderer for", () => {
    expect(() => parseDocument(doc({ type: "iframe" }))).toThrow(/iframe/);
  });

  it("rejects a mark type there is no renderer for", () => {
    expect(() =>
      parseDocument(doc(paragraph("x", [{ type: "script" }]))),
    ).toThrow(/script/);
  });

  it("accepts H1 through H6 and nothing else", () => {
    for (const level of [1, 2, 3, 4, 5, 6])
      expect(() =>
        parseDocument(doc({ type: "heading", attrs: { level } })),
      ).not.toThrow();
    expect(() =>
      parseDocument(doc({ type: "heading", attrs: { level: 7 } })),
    ).toThrow(/level/);
  });

  // A reference without an id resolves to nothing on a live article
  it("rejects a CTA embed with no ctaId", () => {
    expect(() => parseDocument(doc({ type: "ctaEmbed", attrs: {} }))).toThrow(
      /ctaId/,
    );
  });

  it("rejects an entry reference with an unknown entry type", () => {
    expect(() =>
      parseDocument(
        doc({ type: "entryEmbed", attrs: { entryType: "user", entryId: "x" } }),
      ),
    ).toThrow(/entryType/);
  });

  it("refuses a link that could run script, and keeps a safe one", () => {
    for (const href of [
      "javascript:alert(1)",
      "data:text/html,x",
      "//evil.com",
      // A URL parser strips these before reading, turning each into //evil.com
      "/\t/evil.com",
      "/\n/evil.com",
      "/\r\n/evil.com",
      "/\\evil.com",
    ])
      expect(() =>
        parseDocument(doc(paragraph("x", [{ type: "link", attrs: { href } }]))),
      ).toThrow(/link/);

    for (const href of [
      "https://example.com",
      "mailto:a@b.co",
      "/trade",
      "#faq",
    ])
      expect(() =>
        parseDocument(doc(paragraph("x", [{ type: "link", attrs: { href } }]))),
      ).not.toThrow();
  });

  it("refuses a link class or a rel of the document's choosing", () => {
    const link = (attrs: Record<string, unknown>) =>
      doc(
        paragraph("x", [
          { type: "link", attrs: { href: "https://example.com", ...attrs } },
        ]),
      );
    expect(() => parseDocument(link({ class: "fixed inset-0 z-50" }))).toThrow(
      /class/,
    );
    expect(() => parseDocument(link({ rel: "opener" }))).toThrow(/rel/);
    expect(() => parseDocument(link({}))).not.toThrow();
  });

  it("refuses content in the wrong place, not only unknown types", () => {
    expect(() => parseDocument(doc({ type: "text", text: "loose" }))).toThrow(
      BadRequestException,
    );
    expect(() => parseDocument(doc({ type: "tableRow", content: [] }))).toThrow(
      BadRequestException,
    );
  });

  it("drops attributes the schema does not define", () => {
    const parsed = parseDocument(
      doc({
        type: "paragraph",
        attrs: { onclick: "alert(1)" },
        content: [{ type: "text", text: "x" }],
      }),
    );
    expect(JSON.stringify(parsed)).not.toContain("onclick");
  });

  it("bounds table spans", () => {
    const table = (colspan: number) =>
      doc({
        type: "table",
        content: [
          {
            type: "tableRow",
            content: [
              {
                type: "tableCell",
                attrs: { colspan },
                content: [paragraph("x")],
              },
            ],
          },
        ],
      });
    expect(() => parseDocument(table(2))).not.toThrow();
    expect(() => parseDocument(table(100_000))).toThrow(/colspan/);
  });

  it("names where in the document the problem is", () => {
    expect(() =>
      parseDocument(doc(paragraph("ok"), { type: "ctaEmbed", attrs: {} })),
    ).toThrow(/body\.content\[1\]/);
  });
});

describe("collectReferences", () => {
  it("finds every reference, from nodes and from marks", () => {
    const references = collectReferences(REFERENCING);
    expect([...references.ctaIds]).toEqual(["cta-1"]);
    expect([...references.mediaIds].sort()).toEqual(["media-1", "media-2"]);
    expect(references.entries).toEqual([
      { type: "blog", id: "blog-1" },
      { type: "category", id: "cat-1" },
    ]);
  });

  it("finds nothing in a plain document", () => {
    const references = collectReferences(doc(paragraph("plain")));
    expect(
      references.ctaIds.size +
        references.mediaIds.size +
        references.entries.length,
    ).toBe(0);
  });
});

describe("remapReferences — Space clone", () => {
  const maps = {
    cta: new Map([["cta-1", "cta-1-copy"]]),
    entries: {
      blog: new Map([["blog-1", "blog-1-copy"]]),
      category: new Map([["cat-1", "cat-1-copy"]]),
      tag: new Map<string, string>(),
      author: new Map<string, string>(),
    },
  };

  it("points CTA embeds and entry references at the copies", () => {
    const references = collectReferences(remapReferences(REFERENCING, maps));
    expect([...references.ctaIds]).toEqual(["cta-1-copy"]);
    expect(references.entries).toEqual([
      { type: "blog", id: "blog-1-copy" },
      { type: "category", id: "cat-1-copy" },
    ]);
  });

  // The media library is global, so both Spaces share one image
  it("leaves image references alone", () => {
    const references = collectReferences(remapReferences(REFERENCING, maps));
    expect([...references.mediaIds].sort()).toEqual(["media-1", "media-2"]);
  });

  it("keeps an unmapped reference rather than dropping content from the copy", () => {
    const orphan = doc({ type: "ctaEmbed", attrs: { ctaId: "gone" } });
    expect(collectReferences(remapReferences(orphan, maps)).ctaIds).toEqual(
      new Set(["gone"]),
    );
  });

  it("does not mutate the source document", () => {
    const before = JSON.stringify(REFERENCING);
    remapReferences(REFERENCING, maps);
    expect(JSON.stringify(REFERENCING)).toBe(before);
  });

  it("preserves text and formatting untouched", () => {
    const remapped = remapReferences(REFERENCING, maps);
    expect(remapped.content?.[0]).toEqual(REFERENCING.content?.[0]);
    expect(remapped.content?.[1]).toEqual(REFERENCING.content?.[1]);
  });
});
