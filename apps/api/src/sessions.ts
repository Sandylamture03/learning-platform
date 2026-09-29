// Sessions: a random token in an httpOnly cookie, and its SHA-256 hash in the database. The token is 256 random
// bits, so a fast hash is enough (unlike passwords, it can't be guessed), and a database leak signs nobody in.
import { createHash, randomBytes } from 'node:crypto';
import type { User } from '@lp/contracts';
import type { CookieOptions } from 'express';
import type { Pool } from 'pg';

export const SESSION_COOKIE = 'lp_session';

const hashToken = (token: string) => createHash('sha256').update(token).digest();

/** The cookie's settings. HttpOnly keeps it from page scripts; SameSite=Lax keeps it off cross-site writes. */
export function sessionCookie(production: boolean, expires?: Date): CookieOptions {
  return { httpOnly: true, sameSite: 'lax', secure: production, path: '/', ...(expires ? { expires } : {}) };
}

export async function createSession(db: Pool, userId: string, days: number, now = new Date()) {
  const token = randomBytes(32).toString('base64url');
  const expires = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  // Tidy this learner's expired sessions while we are here.
  await db.query('DELETE FROM sessions WHERE user_id = $1 AND expires_at <= $2', [userId, now]);
  await db.query('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES ($1, $2, $3, $4)', [
    hashToken(token),
    userId,
    now,
    expires,
  ]);
  return { token, expires };
}

/** The learner a token signs in, or null when it is unknown or has expired. */
export async function findSessionUser(db: Pool, token: string, now = new Date()): Promise<User | null> {
  const { rows } = await db.query<User>(
    `SELECT u.id, u.name, u.email
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > $2`,
    [hashToken(token), now],
  );
  return rows[0] ?? null;
}

export async function deleteSession(db: Pool, token: string): Promise<void> {
  await db.query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]);
}

/** One cookie's value from a Cookie header, without a cookie-parsing dependency. */
export function readCookie(header: string | undefined, name: string): string | undefined {
  for (const part of header?.split(';') ?? []) {
    const eq = part.indexOf('=');
    if (eq !== -1 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return undefined;
}
