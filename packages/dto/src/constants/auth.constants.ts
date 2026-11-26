// The cookie that carries a signed-in browser's session token. The admin app only checks that it is
// there, to send someone without one straight to the sign-in page; the API decides whether it works.
export const SESSION_COOKIE_NAME = "loom_session";

// Where a password link lands in the admin app. The token rides in the fragment, which browsers
// never send to a server, so it stays out of access logs and Referer headers.
export const SET_PASSWORD_PATH = "/set-password";
