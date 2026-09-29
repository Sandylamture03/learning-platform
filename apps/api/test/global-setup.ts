// Before any test: make sure the test database exists, and say how to start Postgres when it can't be reached.
import pg from 'pg';
import { TEST_DATABASE_URL } from './db.ts';

export default async function setup() {
  const url = new URL(TEST_DATABASE_URL);
  const name = url.pathname.slice(1);
  const server = new pg.Client({ connectionString: Object.assign(new URL(url), { pathname: '/postgres' }).href });
  try {
    await server.connect();
  } catch (error) {
    throw new Error(
      `The API tests need PostgreSQL at ${url.host}: start it with \`pnpm db:up\` (Docker), or set TEST_DATABASE_URL. (${(error as Error).message})`,
    );
  }
  try {
    const { rowCount } = await server.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
    if (rowCount === 0) await server.query(`CREATE DATABASE ${pg.escapeIdentifier(name)}`);
  } finally {
    await server.end();
  }
}
