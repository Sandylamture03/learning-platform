// The pieces of sign-in: password hashes, session tokens and a role check.
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

/** "salt:hash" in hex: a new 16-byte salt each time, and a 32-byte scrypt hash. */
export async function hashPassword(password) {
  throw new Error('Write hashPassword');
}

/** Whether `password` matches a value from hashPassword. False, never an error, for anything malformed. */
export async function verifyPassword(password, stored) {
  throw new Error('Write verifyPassword');
}

/** { token, tokenHash }: 32 random bytes in base64url for the cookie, and its SHA-256 in hex for the database. */
export function newSessionToken() {
  throw new Error('Write newSessionToken');
}

/** Express middleware: 401 without req.user, 403 when req.user.role is not one of `roles`, else next(). */
export function requireRole(...roles) {
  return (req, res, next) => {
    next();
  };
}
