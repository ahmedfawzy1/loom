import { LOGIN_PATH, loginHref } from "@loom-web/src/lib/auth/redirect";
import axios, { isAxiosError } from "axios";

// Same-origin: next.config.ts rewrites /admin/* to the CMS API, so the session cookie rides along
// without any cross-site cookie or CORS configuration.
export const api = axios.create({
  baseURL: "/admin",
  timeout: 30_000,
});

// Calls whose 401 is an answer for the page that made them — a wrong password — rather than a sign
// that the session ended
const ANSWERS_FOR_ITSELF =
  /^\/?auth\/(login|logout|password-link|set-password)$/;

// Any other 401 means the session ended: it ran out, they signed out in another tab, or an Admin
// disabled them. They are sent to sign in, and brought back here afterwards.
api.interceptors.response.use(undefined, (error: unknown) => {
  if (
    typeof window !== "undefined" &&
    isAxiosError(error) &&
    error.response?.status === 401 &&
    !ANSWERS_FOR_ITSELF.test(error.config?.url ?? "") &&
    window.location.pathname !== LOGIN_PATH
  )
    window.location.assign(
      loginHref(`${window.location.pathname}${window.location.search}`),
    );
  return Promise.reject(error);
});

export class ApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** A reference whose target is gone, as opposed to one that could not be loaded right now. */
export const isNotFound = (error: unknown) =>
  error instanceof ApiError && error.status === 404;

/**
 * The API's message, after what was being attempted. With `detailOnly`, the API's words stand
 * alone when there are some — on the sign-in pages they already say everything.
 */
export const handleError = (
  error: unknown,
  message: string,
  { detailOnly = false }: { detailOnly?: boolean } = {},
): ApiError => {
  if (isAxiosError(error)) {
    const detail = error.response?.data?.message;
    // class-validator answers with an array of messages; the first is the useful one
    const text = Array.isArray(detail) ? detail[0] : detail;
    const shown = text ? (detailOnly ? text : `${message}: ${text}`) : message;
    return new ApiError(shown, error.response?.status);
  }
  return new ApiError(message);
};
