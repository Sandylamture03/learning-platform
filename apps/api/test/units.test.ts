// The pieces with no HTTP around them: password hashing, cookies, config and migrations.
import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LOCAL_DATABASE_URL, loadConfig } from '../src/config.ts';
import { MIGRATIONS_DIR, migrate } from '../src/migrate.ts';
import { hashPassword, verifyPassword } from '../src/passwords.ts';
import { readCookie } from '../src/sessions.ts';
import { testDatabase } from './db.ts';

describe('passwords', () => {
  it('hash with a fresh salt each time, and verify only the right password', async () => {
    const [one, two] = await Promise.all([hashPassword('pässwörd one'), hashPassword('pässwörd one')]);
    expect(one).not.toBe(two);
    expect(await verifyPassword('pässwörd one', one)).toBe(true);
    expect(await verifyPassword('pässwörd one', two)).toBe(true);
    expect(await verifyPassword('pässwörd two', one)).toBe(false);
  });

  it('treat the same text typed two ways as one password (Unicode NFC)', async () => {
    const composed = 'café-password';
    const decomposed = 'café-password';
    expect(await verifyPassword(decomposed, await hashPassword(composed))).toBe(true);
  });

  it('refuse a stored value they cannot read, instead of throwing', async () => {
    for (const stored of ['', 'plain-text', 'bcrypt$10$abc', 'scrypt$x$8$3$c2FsdA$aGFzaA', 'scrypt$32768$8$3$$']) {
      expect(await verifyPassword('anything', stored), stored).toBe(false);
    }
  });
});

describe('readCookie', () => {
  it('finds one cookie among several', () => {
    expect(readCookie('theme=dark; lp_session=abc-123; other=1', 'lp_session')).toBe('abc-123');
    expect(readCookie('xlp_session=nope', 'lp_session')).toBeUndefined();
    expect(readCookie(undefined, 'lp_session')).toBeUndefined();
  });
});

describe('loadConfig', () => {
  it('has development defaults', () => {
    expect(loadConfig({})).toEqual({
      production: false,
      databaseUrl: LOCAL_DATABASE_URL,
      port: 3000,
      trustProxy: 0,
      sessionDays: 30,
      authAttempts: 20,
    });
  });

  it('refuses to start production without a database, or with a typo', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow('Set DATABASE_URL');
    expect(() => loadConfig({ PORT: 'eighty' })).toThrow(/environment variables have problems:\n {2}PORT:/);
  });
});

describe('migrate', () => {
  it('applies each migration once', async () => {
    const { db, drop } = await testDatabase(); // already migrated
    try {
      expect(await migrate(db)).toEqual([]);
      const { rows } = await db.query('SELECT name FROM schema_migrations ORDER BY name');
      expect(rows.map((r) => r.name)).toEqual(readdirSync(MIGRATIONS_DIR).sort());
    } finally {
      await drop();
    }
  });
});
