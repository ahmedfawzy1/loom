import { createHash, randomBytes } from "node:crypto";
import type { ApiKey } from "@loom/database";
import {
  API_KEY_PREFIX,
  API_KEY_SECRET_BYTES,
  API_KEY_VISIBLE_LENGTH,
} from "./api-key.constants";

/**
 * A key is 32 random bytes, so a fast hash is enough to store it: there is nothing to brute-force
 * the way there is with a password, and the lookup runs on every Content API request.
 */
export const hashApiKey = (key: string): ApiKey["keyHash"] =>
  createHash("sha256").update(key).digest("hex");

export function generateApiKey() {
  const key = `${API_KEY_PREFIX}${randomBytes(API_KEY_SECRET_BYTES).toString("base64url")}`;
  return {
    key,
    keyHash: hashApiKey(key),
    keyPrefix: key.slice(0, API_KEY_VISIBLE_LENGTH),
  };
}
