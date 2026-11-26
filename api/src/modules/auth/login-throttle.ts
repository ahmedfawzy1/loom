import { Injectable } from "@nestjs/common";
import {
  LOGIN_FAILURE_WINDOW_MS,
  LOGIN_MAX_FAILURES_PER_EMAIL,
  LOGIN_MAX_FAILURES_PER_IP,
  LOGIN_THROTTLE_MAX_KEYS,
} from "./auth.constants";

export interface ThrottleKey {
  key: string;
  /** Failures allowed in one window before this key is refused. */
  limit: number;
}

interface FailureWindow {
  failures: number;
  endsAt: number;
}

export const emailThrottleKey = (email: string): ThrottleKey => ({
  key: `email:${email}`,
  limit: LOGIN_MAX_FAILURES_PER_EMAIL,
});

export const ipThrottleKey = (ip: string): ThrottleKey => ({
  key: `ip:${ip}`,
  limit: LOGIN_MAX_FAILURES_PER_IP,
});

/**
 * Counts failed sign-ins, in memory. The API runs as a single instance, which is also why API key
 * rate limits live in memory; a restart forgets the counts, which only ever errs towards letting
 * someone try again.
 */
@Injectable()
export class LoginThrottle {
  private readonly windows = new Map<string, FailureWindow>();

  /** How long until every key may try again: 0 when none is over its limit. */
  retryAfterMs(keys: readonly ThrottleKey[], now = Date.now()): number {
    let wait = 0;
    for (const { key, limit } of keys) {
      const window = this.live(key, now);
      if (window && window.failures >= limit)
        wait = Math.max(wait, window.endsAt - now);
    }
    return wait;
  }

  recordFailure(keys: readonly ThrottleKey[], now = Date.now()) {
    for (const { key } of keys) {
      const window = this.live(key, now);
      if (window) {
        window.failures += 1;
        continue;
      }
      this.makeRoom(now);
      this.windows.set(key, {
        failures: 1,
        endsAt: now + LOGIN_FAILURE_WINDOW_MS,
      });
    }
  }

  clear(key: ThrottleKey) {
    this.windows.delete(key.key);
  }

  private live(key: string, now: number): FailureWindow | undefined {
    const window = this.windows.get(key);
    if (window && window.endsAt <= now) {
      this.windows.delete(key);
      return undefined;
    }
    return window;
  }

  /** Drops finished windows, then the oldest, so a flood of new keys cannot grow the map forever. */
  private makeRoom(now: number) {
    if (this.windows.size < LOGIN_THROTTLE_MAX_KEYS) return;
    for (const [key, window] of this.windows)
      if (window.endsAt <= now) this.windows.delete(key);
    for (const key of this.windows.keys()) {
      if (this.windows.size < LOGIN_THROTTLE_MAX_KEYS) return;
      this.windows.delete(key);
    }
  }
}
