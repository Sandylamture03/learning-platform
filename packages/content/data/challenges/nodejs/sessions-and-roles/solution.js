// The pieces of sign-in: password hashes, session tokens and a role check.
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

/** "salt:hash" in hex: a new 16-byte salt each time, and a 32-byte scrypt hash. */
export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 32);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

/** Whether `password` matches a value from hashPassword. False, never an error, for anything malformed. */
export async function verifyPassword(password, stored) {
  const [salt, hash] = typeof stored === 'string' ? stored.split(':') : [];
  if (!/^[0-9a-f]{32}$/.test(salt ?? '') || !/^[0-9a-f]{64}$/.test(hash ?? '')) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = await scryptAsync(password, Buffer.from(salt, 'hex'), expected.length);
  // Constant time: how long this takes doesn't reveal how much of the hash matched.
  return timingSafeEqual(actual, expected);
}

/** { token, tokenHash }: 32 random bytes in base64url for the cookie, and its SHA-256 in hex for the database. */
export function newSessionToken() {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  return { token, tokenHash };
}

/** Express middleware: 401 without req.user, 403 when req.user.role is not one of `roles`, else next(). */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Sign in first' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'You cannot do that' });
    next();
  };
}
