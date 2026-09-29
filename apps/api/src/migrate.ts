// Applies the SQL files in migrations/ in name order, each once, each in its own transaction.
// Applied names are recorded in schema_migrations; an advisory lock stops two servers migrating at once.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Pool } from 'pg';

export const MIGRATIONS_DIR = join(import.meta.dirname, '..', 'migrations');
const NAME = /^\d{3}_[a-z0-9_]+\.sql$/;
/** Any number, as long as nothing else in the database uses it for pg_advisory_lock. */
const LOCK = 4_720_001;

/** Applies what is new and returns the names it applied. */
export async function migrate(pool: Pool, dir = MIGRATIONS_DIR): Promise<string[]> {
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  const misnamed = files.filter((f) => !NAME.test(f));
  if (misnamed.length > 0) throw new Error(`Name migrations like 002_add_badges.sql: ${misnamed.join(', ')}`);

  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK]);
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
    );
    const { rows } = await client.query<{ name: string }>('SELECT name FROM schema_migrations');
    const done = new Set(rows.map((r) => r.name));
    const applied: string[] = [];
    for (const file of files) {
      if (done.has(file)) continue;
      const sql = await readFile(join(dir, file), 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} failed, and nothing from it was applied: ${(error as Error).message}`, {
          cause: error,
        });
      }
      applied.push(file);
    }
    return applied;
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK]).catch(() => {});
    client.release();
  }
}
