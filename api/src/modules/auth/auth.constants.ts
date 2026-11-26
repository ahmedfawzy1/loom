// A session ends after this long unused. Using it pushes the end back, so someone who works in Loom
// at least once a month stays signed in.
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// How often a session's expiry and its person's lastActiveAt are written: not on every request,
// which would add a database write to each call for no gain. lastActiveAt is for the Users screen,
// not analytics.
export const LAST_ACTIVE_WRITE_INTERVAL_MS = 5 * 60 * 1000;

// Failed sign-ins, counted over a window that starts at the first failure. Per email, so no one
// account can be guessed at faster than this; per client address, so no one source can work through
// many accounts. A success clears the email's count.
export const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_MAX_FAILURES_PER_EMAIL = 10;
export const LOGIN_MAX_FAILURES_PER_IP = 50;
// The most windows kept at once, so a flood of made-up emails cannot grow the map without bound
export const LOGIN_THROTTLE_MAX_KEYS = 10_000;

// One answer for a wrong email and a wrong password, so a sign-in never says who has an account
export const WRONG_CREDENTIALS =
  "That email and password don't match an account";

export const ACCOUNT_DISABLED =
  "This account is disabled. Ask an Admin to reactivate it.";

// One answer for every link that does not work: unknown, used, expired, or for a disabled account
export const PASSWORD_LINK_NOT_VALID =
  "This link has expired or has already been used. Ask an Admin to send you a new one.";
