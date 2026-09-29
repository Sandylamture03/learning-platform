// Password hashing with scrypt, from node:crypto: slow and memory-hard on purpose, so a leaked table is
// expensive to guess against. Each hash carries its own salt and cost, so the cost can rise later.
import { randomBytes, type ScryptOptions, scrypt, timingSafeEqual } from 'node:crypto';

/** N = 2^15, r = 8, p = 3: one of the settings the OWASP Password Storage Cheat Sheet recommends (32 MiB). */
const COST = { N: 2 ** 15, r: 8, p: 3 };
const KEY_BYTES = 32;
const SALT_BYTES = 16;
const MAX_MEMORY = 128 * 1024 * 1024;

function derive(password: string, salt: Buffer, bytes: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // NFC: the same password typed on another keyboard can arrive as different code points.
    scrypt(password.normalize('NFC'), salt, bytes, { ...options, maxmem: MAX_MEMORY }, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

/** scrypt$N$r$p$salt$hash, with the salt and hash in base64url. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const hash = await derive(password, salt, KEY_BYTES, COST);
  return ['scrypt', COST.N, COST.r, COST.p, salt.toString('base64url'), hash.toString('base64url')].join('$');
}

/** Whether `password` matches `stored`. Compares in constant time, and is false for a hash it can't read. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  const cost = { N: Number(n), r: Number(r), p: Number(p) };
  if (!Object.values(cost).every(Number.isSafeInteger) || expected.length === 0) return false;
  const actual = await derive(password, Buffer.from(salt, 'base64url'), expected.length, cost);
  return timingSafeEqual(actual, expected);
}

let dummy: Promise<string> | undefined;
/**
 * A real hash of nothing in particular. Checking a password against it when the email is unknown makes a
 * failed sign-in take as long either way, so response times don't reveal which emails have accounts.
 */
export function dummyHash(): Promise<string> {
  dummy ??= hashPassword(randomBytes(16).toString('hex'));
  return dummy;
}
