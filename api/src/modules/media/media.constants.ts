// Where an upload lands. Private: nothing here is served, and the bucket lifecycle rule expires it
// after a day, so an upload that is never confirmed cleans itself up.
export const PENDING_PREFIX = "pending/";

// Where a confirmed image is copied to. The only prefix the bucket policy makes publicly readable.
export const MEDIA_PREFIX = "media/";

// How long a presigned upload stays valid — long enough for a slow connection to finish a large
// image, short enough that a leaked policy is not a standing write credential to the bucket.
export const UPLOAD_URL_TTL_SECONDS = 10 * 60;

// How long after asking for an upload it can still be confirmed. Longer than the URL itself, so an
// upload that finishes in its last second is not refused on the way to being confirmed.
export const PENDING_UPLOAD_CLAIM_SECONDS = 60 * 60;

// Decoding a 15 MB file can still inflate to gigabytes of pixels; this refuses anything past ~100 MP
export const MAX_INPUT_PIXELS = 100_000_000;

/** sharp's name for each accepted format. AVIF reports as "heif", and is told apart by its codec. */
export const MIME_BY_SHARP_FORMAT: Record<string, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};
