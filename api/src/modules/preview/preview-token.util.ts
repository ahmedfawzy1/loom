import { createHmac, timingSafeEqual } from "node:crypto";
import type { PreviewableContentType } from "@loom/dto/constants";

/**
 * What a Preview link vouches for. Kept to ids, not slugs: a slug can change between the click
 * and the resolve, and the website should land on the item as it is saved now.
 */
export interface PreviewClaims {
  /** Format version, so a later change can refuse old tokens instead of misreading them. */
  v: 1;
  site: string;
  space: string;
  type: PreviewableContentType;
  id: string;
  lang: string;
  /** Expiry, in milliseconds since the epoch. */
  exp: number;
}

const mac = (body: string, secret: string) =>
  createHmac("sha256", secret).update(body).digest();

/** `<base64url claims>.<base64url HMAC-SHA256 of that>` — a token only its Site's secret can make. */
export function signPreviewToken(
  claims: PreviewClaims,
  secret: string,
): string {
  const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${body}.${mac(body, secret).toString("base64url")}`;
}

/**
 * The claims of a token this secret signed, or null for anything else — malformed, tampered with,
 * or signed by another Site. Expiry is the caller's to judge, so it can say so in its own words.
 */
export function readPreviewToken(
  token: string,
  secret: string,
): PreviewClaims | null {
  const [body, signature, ...rest] = token.split(".");
  if (!body || !signature || rest.length) return null;

  const expected = mac(body, secret);
  const given = Buffer.from(signature, "base64url");
  // Constant-time, so how much of a guess matches never shows in how long the answer takes
  if (given.length !== expected.length || !timingSafeEqual(given, expected))
    return null;

  try {
    const claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return claims?.v === 1 ? (claims as PreviewClaims) : null;
  } catch {
    return null;
  }
}
