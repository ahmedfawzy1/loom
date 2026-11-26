import { translationState } from "@loom/dto/constants";
import { describe, expect, it } from "vitest";
import { stableStringify } from "./stable-json.util";

describe("stableStringify", () => {
  // jsonb reorders keys, so a snapshot read back from Postgres must still compare equal
  it("is the same for equal values whatever their key order", () => {
    expect(
      stableStringify({ b: 1, a: { d: [1, { y: 2, x: 1 }], c: null } }),
    ).toBe(stableStringify({ a: { c: null, d: [1, { x: 1, y: 2 }] }, b: 1 }));
  });

  it("differs when a value does", () => {
    expect(stableStringify({ a: 1 })).not.toBe(stableStringify({ a: 2 }));
  });
});

describe("translationState — plan §7", () => {
  const source = { languageCode: "en", contentRevision: 5 };
  const de = (sourceRevision: number | null) => ({
    languageCode: "de",
    sourceRevision,
  });

  it("is stale when made from an older source", () => {
    expect(translationState(de(3), source)).toBe("stale");
  });

  it("is current when made from the latest source content", () => {
    expect(translationState(de(5), source)).toBe("current");
  });

  // Written before tracking, or imported: nobody knows, so it is not shown as up to date
  it("is untracked with nothing recorded", () => {
    expect(translationState(de(null), source)).toBe("untracked");
  });

  it("the source language is the source", () => {
    expect(
      translationState({ languageCode: "en", sourceRevision: null }, source),
    ).toBe("source");
    expect(translationState(de(1), undefined)).toBe("source");
  });
});
