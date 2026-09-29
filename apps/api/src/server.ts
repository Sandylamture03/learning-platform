// `pnpm dev:api` and `pnpm --filter @lp/api start`: the API on PORT (3000), against DATABASE_URL.
import { loadContent } from '@lp/content';
import pg from 'pg';
import { createApp } from './app.ts';
import { loadConfig } from './config.ts';
import { WEB_DIRS } from './web.ts';

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
  ...(config.serveWeb ? { web: WEB_DIRS } : {}),
});

const server = app.listen(config.port, () => {
  const base = `http://localhost:${config.port}`;
  console.log(
    config.serveWeb
      ? `Serving the site at ${base}/, the app at ${base}/app/ and the API at ${base}/api`
      : `The API is listening on ${base}/api`,
  );
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
