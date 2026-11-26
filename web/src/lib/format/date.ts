import { DAY_MS } from "@loom-web/src/constants/time.constants";

const RELATIVE = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * DAY_MS],
  ["month", 30 * DAY_MS],
  ["week", 7 * DAY_MS],
  ["day", DAY_MS],
  ["hour", DAY_MS / 24],
  ["minute", DAY_MS / 24 / 60],
];

/** "3 hours ago", "yesterday" — for when something happened, read at a glance. */
export const formatRelative = (value: string | Date) => {
  const elapsed = new Date(value).getTime() - Date.now();
  const [unit, size] = UNITS.find(
    ([, candidate]) => Math.abs(elapsed) >= candidate,
  ) ?? ["minute", DAY_MS / 24 / 60];
  return Math.abs(elapsed) < DAY_MS / 24 / 60
    ? "just now"
    : RELATIVE.format(Math.round(elapsed / size), unit);
};

/** "19 Sept 2026, 09:26" — the exact moment, for a tooltip or an audit trail. */
export const formatDateTime = (value: string | Date) =>
  new Date(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/** "19 Sept 2026" */
export const formatDate = (value: string | Date) =>
  new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
