import { describe, expect, it } from "vitest";
import {
  LOGIN_FAILURE_WINDOW_MS,
  LOGIN_MAX_FAILURES_PER_EMAIL,
  LOGIN_THROTTLE_MAX_KEYS,
} from "./auth.constants";
import {
  emailThrottleKey,
  ipThrottleKey,
  LoginThrottle,
} from "./login-throttle";

const NOW = 1_000_000;
const ada = emailThrottleKey("ada@example.com");

function failTimes(throttle: LoginThrottle, times: number, now = NOW) {
  for (let i = 0; i < times; i++) throttle.recordFailure([ada], now);
}

describe("LoginThrottle", () => {
  it("refuses a key once it reaches its limit, until its window ends", () => {
    const throttle = new LoginThrottle();
    failTimes(throttle, LOGIN_MAX_FAILURES_PER_EMAIL - 1);
    expect(throttle.retryAfterMs([ada], NOW)).toBe(0);

    failTimes(throttle, 1);
    expect(throttle.retryAfterMs([ada], NOW + 1000)).toBe(
      LOGIN_FAILURE_WINDOW_MS - 1000,
    );
    expect(throttle.retryAfterMs([ada], NOW + LOGIN_FAILURE_WINDOW_MS)).toBe(0);
  });

  it("counts each key on its own", () => {
    const throttle = new LoginThrottle();
    failTimes(throttle, LOGIN_MAX_FAILURES_PER_EMAIL);
    expect(
      throttle.retryAfterMs([emailThrottleKey("bob@example.com")], NOW),
    ).toBe(0);
  });

  it("refuses when any one of the keys is over its limit", () => {
    const throttle = new LoginThrottle();
    const ip = ipThrottleKey("203.0.113.7");
    failTimes(throttle, LOGIN_MAX_FAILURES_PER_EMAIL);
    expect(throttle.retryAfterMs([ip, ada], NOW)).toBeGreaterThan(0);
  });

  it("forgets a key's failures when it is cleared", () => {
    const throttle = new LoginThrottle();
    failTimes(throttle, LOGIN_MAX_FAILURES_PER_EMAIL);
    throttle.clear(ada);
    expect(throttle.retryAfterMs([ada], NOW)).toBe(0);
  });

  it("starts a fresh window after the last one ends", () => {
    const throttle = new LoginThrottle();
    failTimes(throttle, LOGIN_MAX_FAILURES_PER_EMAIL - 1);
    failTimes(
      throttle,
      LOGIN_MAX_FAILURES_PER_EMAIL - 1,
      NOW + LOGIN_FAILURE_WINDOW_MS,
    );
    expect(throttle.retryAfterMs([ada], NOW + LOGIN_FAILURE_WINDOW_MS)).toBe(0);
  });

  it("stays bounded under a flood of made-up emails", () => {
    const throttle = new LoginThrottle();
    for (let i = 0; i <= LOGIN_THROTTLE_MAX_KEYS + 10; i++)
      throttle.recordFailure([emailThrottleKey(`${i}@example.com`)], NOW);
    const { windows } = throttle as unknown as {
      windows: Map<string, unknown>;
    };
    expect(windows.size).toBeLessThanOrEqual(LOGIN_THROTTLE_MAX_KEYS);
  });
});
