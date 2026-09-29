// `pnpm db:migrate`: brings the database in DATABASE_URL up to date, creating the database first if the server
// does not have it yet.
import pg from 'pg';
import { loadConfig } from './config.ts';
import { migrate } from './migrate.ts';

/** Postgres's code for "database does not exist". */
const NO_SUCH_DATABASE = '3D000';

async function createDatabase(url: string) {
  const target = new URL(url);
  const name = decodeURIComponent(target.pathname.slice(1));
  const server = new pg.Client({ connectionString: Object.assign(new URL(url), { pathname: '/postgres' }).href });
  await server.connect();
  try {
    await server.query(`CREATE DATABASE ${pg.escapeIdentifier(name)}`);
    console.log(`Created the database ${name}`);
  } finally {
    await server.end();
  }
}

const config = loadConfig();
let pool = new pg.Pool({ connectionString: config.databaseUrl });
try {
  let applied: string[];
  try {
    applied = await migrate(pool);
  } catch (error) {
    if ((error as { code?: string }).code !== NO_SUCH_DATABASE) throw error;
    await pool.end();
    await createDatabase(config.databaseUrl);
    pool = new pg.Pool({ connectionString: config.databaseUrl });
    applied = await migrate(pool);
  }
  console.log(applied.length > 0 ? `Applied ${applied.join(', ')}` : 'The database is up to date');
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
