import { SESSION_COOKIE_NAME, SET_PASSWORD_PATH } from "@loom/dto/constants";
import { LOGIN_PATH, loginHref } from "@loom-web/src/lib/auth/redirect";
import { type NextRequest, NextResponse } from "next/server";

// The pages someone signed out may open
const PUBLIC_PAGES = [LOGIN_PATH, SET_PASSWORD_PATH];

/**
 * Sends anyone without a session cookie to sign in, before the CMS renders around them. It only
 * checks that the cookie is there: whether the session is still good is the API's call, and a page
 * whose session has ended is sent to sign in by the API client's first 401.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (
    PUBLIC_PAGES.some(
      (page) => pathname === page || pathname.startsWith(`${page}/`),
    ) ||
    request.cookies.has(SESSION_COOKIE_NAME)
  )
    return NextResponse.next();

  return NextResponse.redirect(
    new URL(loginHref(`${pathname}${search}`), request.url),
  );
}

export const config = {
  // Not what the admin app forwards to the API (/admin, /mcp), which answers for itself, nor Next's
  // own files
  matcher: [
    "/((?!admin|mcp|_next/static|_next/image|favicon.ico|apple-icon.png).*)",
  ],
};
