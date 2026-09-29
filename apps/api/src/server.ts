// `pnpm dev:api` and `pnpm --filter @lp/api start`: the API on PORT (3000), against DATABASE_URL.
import { loadContent } from '@lp/content';
import pg from 'pg';
import { createApp } from './app.ts';
import { loadConfig } from './config.ts';

const config = loadConfig();
const db = new pg.Pool({ connectionString: config.databaseUrl });
// An idle client that loses its connection emits this; without a listener it would crash the process.
db.on('error', (error) => console.error('Database connection error:', error.message));

const app = createApp({
  db,
  content: loadContent(),
  production: config.production,
  trustProxy: config.trustProxy,
  sessionDays: config.sessionDays,
  authAttempts: config.authAttempts,
});

const server = app.listen(config.port, () => {
  console.log(`The API is listening on http://localhost:${config.port}/api`);
});

// Stop taking new requests, finish the ones in flight, then close the database pool.
function shutdown(signal: string) {
  console.log(`${signal}: shutting down`);
  server.close(() => {
    void db.end().then(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
