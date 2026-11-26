export const LOGIN_PATH = "/login";

/**
 * Where to go after signing in: `next` when it is a path on this site, home otherwise. Anything
 * else — `//evil.com`, `/\evil.com`, a full URL — would make the sign-in page an open redirect.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next?.startsWith("/") || /^\/[/\\]/.test(next)) return "/";
  // Back to the sign-in page would only ask them to sign in again
  if (next === LOGIN_PATH || next.startsWith(`${LOGIN_PATH}?`)) return "/";
  return next;
}

/** The sign-in page, set to bring them back to `next` afterwards. */
export function loginHref(next?: string): string {
  const back = safeNextPath(next);
  return back === "/"
    ? LOGIN_PATH
    : `${LOGIN_PATH}?next=${encodeURIComponent(back)}`;
}
