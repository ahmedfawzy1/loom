// Marks a string as a Loom key, so one pasted somewhere it should not be is recognisable
export const API_KEY_PREFIX = "loom_";
export const API_KEY_SECRET_BYTES = 32;
// How much of a key the list shows to tell keys apart — the prefix plus a few random characters
export const API_KEY_VISIBLE_LENGTH = API_KEY_PREFIX.length + 6;
// lastUsedAt is written at most this often per key, not on every request
export const API_KEY_TOUCH_INTERVAL_MS = 60_000;
// How often the in-memory keys are reloaded, for changes made outside this process
export const API_KEY_RELOAD_INTERVAL_MS = 5 * 60_000;
