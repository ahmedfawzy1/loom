// How credentials are written to and checked against the database: password hashes, the one-time
// tokens behind password links and sessions, and email normalisation. The API, the seed and
// `pnpm admin:invite` all write these rows, so they share one definition rather than three that
// could drift — a hash the seed wrote and the API could not check would lock everyone out.
//
// Published as @loom/database/credentials, never from the package root: the root reaches the
// admin app's browser bundle through @loom/dto/models, and this file needs node:crypto.
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// scrypt at one of OWASP's recommended settings (N=2^15, r=8, p=3): about 32 MiB and a few
// hundredths of a second per hash, slow enough to make guessing expensive without letting a burst
// of sign-ins exhaust the API's memory.
const SCRYPT_COST = 2 ** 15;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 3;
const KEY_BYTES = 64;
const SALT_BYTES = 16;
// Node caps scrypt's memory at 32 MiB by default, a little under what these parameters need
const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024;
const SCHEME = "scrypt";

// 32 random bytes: as strong as a key gets, so a fast hash is enough to store a token
const TOKEN_BYTES = 32;

const DAY_MS = 24 * 60 * 60 * 1000;

/** How long a password link works: long enough to reach someone, short enough not to linger. */
export const PASSWORD_LINK_TTL_DAYS = 7;

interface ScryptParams {
  cost: number;
  blockSize: number;
  parallelization: number;
}

function derive(
  password: string,
  salt: Buffer,
  keyBytes: number,
  params: ScryptParams,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // NFKC so the same password typed on two keyboards — a composed é or an e plus an accent —
    // derives the same key
    scrypt(
      password.normalize("NFKC"),
      salt,
      keyBytes,
      { ...params, maxmem: SCRYPT_MAX_MEMORY },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
}

/**
 * `scrypt$<N>$<r>$<p>$<salt>$<key>`, base64url. The parameters travel with each hash, so they can
 * be raised later without invalidating the passwords already stored.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const params = {
    cost: SCRYPT_COST,
    blockSize: SCRYPT_BLOCK_SIZE,
    parallelization: SCRYPT_PARALLELIZATION,
  };
  const key = await derive(password, salt, KEY_BYTES, params);
  return [
    SCHEME,
    params.cost,
    params.blockSize,
    params.parallelization,
    salt.toString("base64url"),
    key.toString("base64url"),
  ].join("$");
}

/** Whether `password` is the one `stored` was made from. A malformed hash matches nothing. */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [scheme, cost, blockSize, parallelization, salt, key] =
    stored.split("$");
  if (scheme !== SCHEME || !salt || !key) return false;

  const params = {
    cost: Number(cost),
    blockSize: Number(blockSize),
    parallelization: Number(parallelization),
  };
  if (!Object.values(params).every((value) => Number.isSafeInteger(value)))
    return false;

  const expected = Buffer.from(key, "base64url");
  if (!expected.length) return false;
  const actual = await derive(
    password,
    Buffer.from(salt, "base64url"),
    expected.length,
    params,
  ).catch(() => undefined);
  return Boolean(actual && timingSafeEqual(actual, expected));
}

/** What is stored in a token's place. A token is random, so there is nothing to slow down. */
export const hashToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

/** A random token for a session cookie or a password link, and the hash kept instead of it. */
export function generateToken(): { token: string; tokenHash: string } {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

/** A fresh password link: the token to send, and the row to store for it. */
export function newPasswordLink(now = new Date()) {
  return {
    ...generateToken(),
    expiresAt: new Date(now.getTime() + PASSWORD_LINK_TTL_DAYS * DAY_MS),
  };
}

/** The form every email is stored and looked up in, so Ada@x.com and ada@x.com are one person. */
export const normalizeEmail = (email: string): string =>
  email.trim().toLowerCase();
