import { createHash, randomBytes } from "node:crypto";
import type { McpToken } from "@loom/database";
import { MCP_TOKEN_TTL_DAYS } from "@loom/dto/constants";
import {
  DAY_MS,
  MCP_TOKEN_PREFIX,
  MCP_TOKEN_SECRET_BYTES,
  MCP_TOKEN_VISIBLE_LENGTH,
} from "./mcp-token.constants";

/**
 * A token is 32 random bytes, so a fast hash is enough to store it: there is nothing to brute-force
 * the way there is with a password, and the lookup runs on every MCP request.
 */
export const hashMcpToken = (token: string): McpToken["tokenHash"] =>
  createHash("sha256").update(token).digest("hex");

export function generateMcpToken() {
  const token = `${MCP_TOKEN_PREFIX}${randomBytes(MCP_TOKEN_SECRET_BYTES).toString("base64url")}`;
  return {
    token,
    tokenHash: hashMcpToken(token),
    tokenPrefix: token.slice(0, MCP_TOKEN_VISIBLE_LENGTH),
  };
}

/** When a token made at `createdAt` stops working. */
export const mcpTokenExpiry = (createdAt: Date): McpToken["expiresAt"] =>
  new Date(createdAt.getTime() + MCP_TOKEN_TTL_DAYS * DAY_MS);
