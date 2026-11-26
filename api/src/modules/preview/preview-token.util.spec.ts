import { describe, expect, it } from "vitest";
import {
  type PreviewClaims,
  readPreviewToken,
  signPreviewToken,
} from "./preview-token.util";

const SECRET = "site-secret";
const claims: PreviewClaims = {
  v: 1,
  site: "site-1",
  space: "space-1",
  type: "BLOG",
  id: "post-1",
  lang: "en",
  exp: Date.now() + 60_000,
};

describe("preview tokens", () => {
  it("reads back exactly what was signed", () => {
    expect(readPreviewToken(signPreviewToken(claims, SECRET), SECRET)).toEqual(
      claims,
    );
  });

  it("refuses a token signed by another Site's secret", () => {
    expect(
      readPreviewToken(signPreviewToken(claims, "other-secret"), SECRET),
    ).toBeNull();
  });

  it("refuses claims edited after signing", () => {
    const [, signature] = signPreviewToken(claims, SECRET).split(".");
    const forged = Buffer.from(
      JSON.stringify({ ...claims, id: "someone-elses-post" }),
    ).toString("base64url");
    expect(readPreviewToken(`${forged}.${signature}`, SECRET)).toBeNull();
  });

  it("refuses a changed signature", () => {
    const token = signPreviewToken(claims, SECRET);
    const flipped = `${token.slice(0, -2)}${token.endsWith("AA") ? "BB" : "AA"}`;
    expect(readPreviewToken(flipped, SECRET)).toBeNull();
  });

  it("refuses malformed tokens without throwing", () => {
    for (const token of ["", "abc", "a.b.c", ".", "not-base64.x"])
      expect(readPreviewToken(token, SECRET)).toBeNull();
  });

  it("refuses a format it does not know", () => {
    const token = signPreviewToken(
      { ...claims, v: 2 } as unknown as PreviewClaims,
      SECRET,
    );
    expect(readPreviewToken(token, SECRET)).toBeNull();
  });
});
