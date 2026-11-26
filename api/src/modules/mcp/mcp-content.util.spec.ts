// The DTOs' class-transformer decorators read metadata the moment they load
import "reflect-metadata";
import { UpdateTagLocaleRequestDto, UpdateTagRequestDto } from "@loom/dto";
import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { McpContext } from "./mcp.context";
import { languageOn, type SaveRequest, saveContent } from "./mcp-content.util";
import { errorMessage } from "./mcp-tool.util";

type TagSave = SaveRequest<UpdateTagLocaleRequestDto, UpdateTagRequestDto>;

const site = {
  name: "Demo Site",
  defaultLanguage: "en",
  languages: [
    { code: "en", enabled: true },
    { code: "es", enabled: true },
    { code: "fr", enabled: false },
  ],
};

const ctx = {
  context: { requireSpace: vi.fn(async () => ({ site })) },
} as unknown as McpContext;

/** A tag that has English text and nothing else. */
function tagSave(overrides: Partial<TagSave> = {}) {
  const saveShared = vi.fn<TagSave["saveShared"]>(async () => undefined);
  const saveText = vi.fn<TagSave["saveText"]>(async () => undefined);
  const request: TagSave = {
    item: { spaceId: "space-1" },
    language: undefined,
    text: {},
    shared: {},
    current: (code) =>
      code === "en"
        ? { title: "Releases", description: "What shipped" }
        : undefined,
    requiredForNew: ["title", "description"],
    textDto: UpdateTagLocaleRequestDto,
    sharedDto: UpdateTagRequestDto,
    saveShared,
    saveText,
    ...overrides,
  };
  return { request, saveShared, saveText };
}

describe("languageOn", () => {
  it("defaults to the site's default language", () => {
    expect(languageOn(site, undefined)).toBe("en");
    expect(languageOn(site, " ")).toBe("en");
  });

  it("accepts any language the site has", () => {
    expect(languageOn(site, "fr")).toBe("fr");
  });

  it("names the enabled languages when refusing one", () => {
    expect(() => languageOn(site, "xx")).toThrow(
      '"xx" is not a language of Demo Site. Use one of: en, es.',
    );
  });
});

describe("saveContent", () => {
  it("refuses a call with nothing to save", async () => {
    const { request } = tagSave();
    await expect(saveContent(ctx, request)).rejects.toThrow("Nothing to save");
  });

  it("merges sent text over what the language has", async () => {
    const { request, saveText, saveShared } = tagSave({
      text: { description: "Everything that shipped" },
    });
    await expect(saveContent(ctx, request)).resolves.toBe("en");
    expect(saveShared).not.toHaveBeenCalled();
    expect(saveText).toHaveBeenCalledWith(
      "en",
      expect.objectContaining({
        title: "Releases",
        description: "Everything that shipped",
      }),
      undefined,
    );
  });

  it("saves shared fields alone through the shared save", async () => {
    const { request, saveText, saveShared } = tagSave({
      shared: { slug: "releases" },
    });
    await saveContent(ctx, request);
    expect(saveText).not.toHaveBeenCalled();
    expect(saveShared).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "releases" }),
    );
  });

  it("saves text and shared fields together as one save", async () => {
    const { request, saveText } = tagSave({
      text: { title: "Shipped" },
      shared: { slug: "shipped" },
    });
    await saveContent(ctx, request);
    expect(saveText).toHaveBeenCalledWith(
      "en",
      expect.objectContaining({ title: "Shipped" }),
      expect.objectContaining({ slug: "shipped" }),
    );
  });

  it("keeps shared fields to the default language", async () => {
    const { request, saveShared, saveText } = tagSave({
      language: "es",
      text: { title: "Novedades", description: "Lo nuevo" },
      shared: { slug: "novedades" },
    });
    await expect(saveContent(ctx, request)).rejects.toThrow(
      'slug is the same in every language, so it is saved with the default language, "en"',
    );
    expect(saveShared).not.toHaveBeenCalled();
    expect(saveText).not.toHaveBeenCalled();
  });

  it("asks a new language for what its first save needs", async () => {
    const { request } = tagSave({
      language: "es",
      text: { title: "Novedades" },
    });
    await expect(saveContent(ctx, request)).rejects.toThrow(
      "There is no es version yet, so the first save needs description.",
    );
  });

  it("lets a new language fill in what it can derive", async () => {
    const { request, saveText } = tagSave({
      language: "es",
      text: { title: "Novedades" },
      completeNew: (text) => ({ ...text, description: "Derivada" }),
    });
    await saveContent(ctx, request);
    expect(saveText).toHaveBeenCalledWith(
      "es",
      expect.objectContaining({ title: "Novedades", description: "Derivada" }),
      undefined,
    );
  });

  it("holds the merged text to the DTO's rules", async () => {
    const { request, saveText } = tagSave({ text: { title: "#releases" } });
    const error = await saveContent(ctx, request).catch((caught) => caught);
    expect(error).toBeInstanceOf(BadRequestException);
    // What the tool hands back to the model: the DTO's own message
    expect(errorMessage(error)).toBe("title must not start with #");
    expect(saveText).not.toHaveBeenCalled();
  });
});
