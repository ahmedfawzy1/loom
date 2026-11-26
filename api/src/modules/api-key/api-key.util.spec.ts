import { describe, expect, it } from "vitest";
import { API_KEY_PREFIX, API_KEY_VISIBLE_LENGTH } from "./api-key.constants";
import { generateApiKey, hashApiKey } from "./api-key.util";

describe("generateApiKey", () => {
  it("stores only a hash, and the hash matches the key it came from", () => {
    const { key, keyHash } = generateApiKey();
    expect(keyHash).not.toContain(key);
    expect(hashApiKey(key)).toBe(keyHash);
  });

  it("shows a prefix that identifies it but is not enough to use it", () => {
    const { key, keyPrefix } = generateApiKey();
    expect(key.startsWith(API_KEY_PREFIX)).toBe(true);
    expect(keyPrefix).toBe(key.slice(0, API_KEY_VISIBLE_LENGTH));
    expect(key.length - keyPrefix.length).toBeGreaterThanOrEqual(36);
  });

  it("never repeats", () => {
    const keys = new Set(
      Array.from({ length: 50 }, () => generateApiKey().key),
    );
    expect(keys.size).toBe(50);
  });
});
