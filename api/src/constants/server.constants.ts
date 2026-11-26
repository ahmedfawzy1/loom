// Keep-alive must outlive the load balancer idle timeout so the balancer closes connections, not
// Node, or the balancer answers 502s.
export const SERVER_KEEP_ALIVE_TIMEOUT_MS = 65_000;
export const SERVER_HEADERS_TIMEOUT_MS = 70_000;

export const DEFAULT_PORT = 4000;

// Above RICH_TEXT_MAX_BYTES (2 MB) with room for a post's other fields and its FAQ
export const REQUEST_BODY_LIMIT = "3mb";
