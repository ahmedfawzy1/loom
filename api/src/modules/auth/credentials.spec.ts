import {
  generateToken,
  hashPassword,
  hashToken,
  newPasswordLink,
  normalizeEmail,
  PASSWORD_LINK_TTL_DAYS,
  verifyPassword,
} from "@loom/database/credentials";
import { describe, expect, it } from "vitest";

// The helpers live in @loom/database so the seed and `pnpm admin:invite` write what the API
// checks; they are tested here, where the API's tests run.

const DAY_MS = 24 * 60 * 60 * 1000;

describe("hashPassword and verifyPassword", () => {
  it("verify the password a hash was made from, and nothing else", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash).not.toContain("correct horse battery");
    await expect(verifyPassword("correct horse battery", hash)).resolves.toBe(
      true,
    );
    await expect(verifyPassword("correct horse batterY", hash)).resolves.toBe(
      false,
    );
    await expect(verifyPassword("", hash)).resolves.toBe(false);
  });

  it("salt every hash, so two people with one password do not share a hash", async () => {
    expect(await hashPassword("same password")).not.toBe(
      await hashPassword("same password"),
    );
  });

  it("keep the parameters in the hash, so raising them later leaves stored ones working", async () => {
    const hash = await hashPassword("a password");
    expect(hash.split("$").slice(0, 4)).toEqual(["scrypt", "32768", "8", "3"]);
  });

  it("treat a composed and a decomposed accent as the same password", async () => {
    // é as one code point, then as an e followed by a combining accent — what two keyboards send
    const composed = "café au lait!".normalize("NFC");
    const decomposed = composed.normalize("NFD");
    expect(decomposed).not.toBe(composed);

    const hash = await hashPassword(composed);
    await expect(verifyPassword(decomposed, hash)).resolves.toBe(true);
  });

  it.each([
    ["an empty string", ""],
    ["another scheme", "bcrypt$2b$10$abc"],
    ["parameters that are not numbers", "scrypt$abc$8$3$c2FsdA$a2V5"],
    ["no salt or key", "scrypt$32768$8$3$$"],
    ["a cost scrypt refuses", "scrypt$1000$8$3$c2FsdA$a2V5"],
  ])("match nothing against %s", async (_, stored) => {
    await expect(verifyPassword("anything", stored)).resolves.toBe(false);
  });
});

describe("tokens", () => {
  it("are random, and stored only as a hash", () => {
    const { token, tokenHash } = generateToken();
    expect(token.length).toBeGreaterThanOrEqual(43);
    expect(tokenHash).toBe(hashToken(token));
    expect(tokenHash).not.toContain(token);
    expect(generateToken().token).not.toBe(token);
  });

  it("make password links that run out after the TTL", () => {
    const now = new Date("2026-11-26T12:00:00Z");
    const link = newPasswordLink(now);
    expect(link.tokenHash).toBe(hashToken(link.token));
    expect(link.expiresAt.getTime() - now.getTime()).toBe(
      PASSWORD_LINK_TTL_DAYS * DAY_MS,
    );
  });
});

describe("normalizeEmail", () => {
  it("makes one form of an address", () => {
    expect(normalizeEmail("  Ada.Lovelace@Example.COM ")).toBe(
      "ada.lovelace@example.com",
    );
  });
});
