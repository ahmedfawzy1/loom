// Marks a string as a Loom MCP token, distinct from a Content API key (`loom_`), so one pasted
// somewhere it should not be is recognisable for what it can do: act as a person, not read a Site
export const MCP_TOKEN_PREFIX = "loom_mcp_";
export const MCP_TOKEN_SECRET_BYTES = 32;
// How much of a token the list shows to tell tokens apart — the prefix plus a few random characters
export const MCP_TOKEN_VISIBLE_LENGTH = MCP_TOKEN_PREFIX.length + 6;
// lastUsedAt is written at most this often per token, not on every request
export const MCP_TOKEN_TOUCH_INTERVAL_MS = 60_000;

export const DAY_MS = 24 * 60 * 60 * 1000;
