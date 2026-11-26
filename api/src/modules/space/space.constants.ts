// Cloning copies every content row a Space holds in one transaction, which outlasts Prisma's 5s
// default. The ceiling is the proxy in front of the API (~100s on Cloudflare's non-Enterprise
// plans, answered as a 524), so the budget sits below it — the server has to be what gives up
// first, or the operator gets an opaque gateway error instead of a real message.
export const SPACE_CLONE_TIMEOUT_MS = 90_000;

// Prisma's default is 2s, which a busy pool can exceed before the clone even starts
export const SPACE_CLONE_MAX_WAIT_MS = 15_000;

// The note stamped on the seed versions each cloned locale starts with
export const CLONE_VERSION_NOTE = "Cloned from";

// The Space every new Site starts with, matching the seed. A Site with no Space can hold no
// content, and deleteSpace enforces the same invariant from the other end.
export const DEFAULT_SPACE_NAME = "Production";
