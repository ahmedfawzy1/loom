import { SLUG_PATTERN } from "@loom/dto/constants";
import { ConflictException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { assertSlugFree, slugify } from "./slug.util";

describe("slugify", () => {
  it("lowercases and dashes a title", () => {
    expect(slugify("Murder Mystery 2")).toBe("murder-mystery-2");
  });

  it("strips accents rather than dropping the letter", () => {
    expect(slugify("Café Guide")).toBe("cafe-guide");
  });

  it("collapses punctuation runs into one dash", () => {
    expect(slugify("Best  MM2 — Godly!! Knives")).toBe("best-mm2-godly-knives");
  });

  it("does not leave a leading or trailing dash", () => {
    expect(slugify("!!Hello!!")).toBe("hello");
  });

  it("caps at the 50 characters the column allows", () => {
    expect(slugify("a".repeat(80))).toHaveLength(50);
  });

  it("does not let the length cap reintroduce a trailing dash", () => {
    // The cut lands mid-separator here, which the first dash-strip has already run past
    const slug = slugify(
      "aaaa bbbb cccc dddd eeee ffff gggg hhhh iiii jjjj kk",
    );
    expect(slug.endsWith("-")).toBe(false);
    expect(SLUG_PATTERN.test(slug)).toBe(true);
  });

  /**
   * The Space-slug version of this returned the literal "space" for any all-non-Latin name, so the
   * second such Space always collided. Here an empty result is returned as empty and the caller
   * decides — BlogService turns it into "set one explicitly" rather than inventing a slug that
   * cannot be distinguished from the next one.
   */
  it("returns empty for a title with nothing slug-able in it", () => {
    expect(slugify("日本語")).toBe("");
    expect(slugify("العربية")).toBe("");
    expect(slugify("!!!")).toBe("");
  });
});

describe("assertSlugFree", () => {
  it("passes when nothing holds the slug", () => {
    expect(() => assertSlugFree("mm2", null, "category")).not.toThrow();
  });

  it("names the live item holding it", () => {
    expect(() =>
      assertSlugFree(
        "mm2",
        { id: "1", title: "Murder Mystery 2", deletedAt: null },
        "category",
      ),
    ).toThrow(/already used by category "Murder Mystery 2"/);
  });

  /**
   * Soft delete does not free a unique slug and Trash is kept forever, so the blocking row is often
   * invisible in every list — the message has to say where to look.
   */
  it("points at the Trash when the holder is trashed", () => {
    expect(() =>
      assertSlugFree(
        "mm2",
        { id: "1", title: "Murder Mystery 2", deletedAt: new Date() },
        "category",
      ),
    ).toThrow(/trashed category/);
  });

  it("throws a ConflictException, so it surfaces as a 409 rather than a 500", () => {
    expect(() =>
      assertSlugFree("mm2", { id: "1", title: "x", deletedAt: null }, "tag"),
    ).toThrow(ConflictException);
  });
});
