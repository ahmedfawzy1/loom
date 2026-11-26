import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { normaliseLocaleText } from "./locale-text.util";

/**
 * The write path every locale writer goes through. Its job is to stop two different kinds of blank
 * reaching the database: a whitespace-only value in a required column, and a whitespace-only value
 * in a column with a unique index, where `""` and `" "` collide but two NULLs do not.
 */
describe("normaliseLocaleText", () => {
  it("trims a required field rather than storing the padding", () => {
    expect(normaliseLocaleText({ title: "  Godly  " }, ["title"])).toEqual({
      title: "Godly",
    });
  });

  it("rejects a required field that is only whitespace", () => {
    // @IsNotEmpty() accepts "   ", so without this the blank reaches the column
    expect(() => normaliseLocaleText({ title: "   " }, ["title"])).toThrow(
      BadRequestException,
    );
  });

  it("rejects a required field that is empty", () => {
    expect(() => normaliseLocaleText({ title: "" }, ["title"])).toThrow(
      BadRequestException,
    );
  });

  it("names the field it rejected", () => {
    expect(() =>
      normaliseLocaleText({ seoMetaTitle: " " }, ["seoMetaTitle"]),
    ).toThrow(/seoMetaTitle/);
  });

  it("nullifies an optional field that trims to empty", () => {
    // The case that matters: @@unique([spaceId, languageCode, seoMetaTitle]) treats NULLs as
    // distinct but empty strings as equal, so two blank SEO titles would collide
    expect(normaliseLocaleText({ seoMetaTitle: "   " })).toEqual({
      seoMetaTitle: null,
    });
    expect(normaliseLocaleText({ seoMetaTitle: "" })).toEqual({
      seoMetaTitle: null,
    });
  });

  it("trims an optional field that has content", () => {
    expect(normaliseLocaleText({ updateNote: "  note  " })).toEqual({
      updateNote: "note",
    });
  });

  it("leaves non-string values alone", () => {
    const body = { type: "doc", content: [] };
    expect(
      normaliseLocaleText({ body, faq: [], revision: 2, publishedAt: null }),
    ).toEqual({ body, faq: [], revision: 2, publishedAt: null });
  });

  it("does not mutate its input", () => {
    const input = { title: "  Godly  " };
    normaliseLocaleText(input, ["title"]);
    expect(input.title).toBe("  Godly  ");
  });

  it("handles the shape each caller actually passes", () => {
    expect(
      normaliseLocaleText(
        {
          title: " Murder Mystery 2 ",
          description: " Values and guides. ",
          seoMetaTitle: "  ",
          seoMetaDescription: undefined,
        },
        ["title", "description"],
      ),
    ).toEqual({
      title: "Murder Mystery 2",
      description: "Values and guides.",
      seoMetaTitle: null,
      seoMetaDescription: undefined,
    });
  });
});
