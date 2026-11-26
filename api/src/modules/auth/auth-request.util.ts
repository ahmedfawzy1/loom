import type { Request } from "express";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** One cookie's value from a Cookie header. Express parses none by itself. */
export function readCookie(
  header: string | undefined,
  name: string,
): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1 || part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim()) || undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/** Whether a request is for the admin API, the part of the API a browser session signs in to. */
export const isAdminRequest = (request: Request): boolean =>
  request.path === "/admin" || request.path.startsWith("/admin/");

/**
 * A state-changing request a browser says another site made. The session cookie is SameSite=Lax,
 * which keeps it off other sites' requests, but a "site" is a registrable domain: a sibling
 * subdomain (blog.example.com, for cms.example.com) is the same site, and its pages could still post
 * with the cookie. Fetch Metadata names the real relationship, and every browser the admin app
 * supports sends it. A client that sends none (curl, the demo seed) is not a browser carrying
 * somebody else's cookie, so it is not refused.
 */
export function isCrossSiteWrite(request: Request): boolean {
  if (SAFE_METHODS.has(request.method)) return false;
  const site = request.headers["sec-fetch-site"];
  return site === "cross-site" || site === "same-site";
}

/**
 * The client's address, when a proxy in front reported one. With no X-Forwarded-For, request.ip is
 * the admin app's own server — every sign-in would share it, and one person's typos would lock out
 * everyone — so there is no address to count by.
 */
export const clientIp = (request: Request): string | undefined =>
  request.headers["x-forwarded-for"] ? request.ip : undefined;
