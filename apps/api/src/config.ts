// Settings come from environment variables, checked once at startup so a typo fails loudly instead of later.
import { z } from 'zod';

/** The database `docker compose up` starts (compose.yaml). */
export const LOCAL_DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/learning_platform';

const Env = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1).optional(),
  PORT: z.coerce.number().int().min(0).max(65_535).default(3000),
  /** How many proxies sit in front of the API, so rate limits see the learner's address, not the proxy's. */
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),
  /** How long a sign-in lasts. */
  SESSION_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  /** Failed sign-ins, and sign-ups, allowed per address in each 15 minutes. */
  AUTH_ATTEMPTS: z.coerce.number().int().min(1).default(20),
  /** Also serve the built site at / and the built app at /app/ (on by default in production). */
  SERVE_WEB: z.enum(['true', 'false', '1', '0']).optional(),
});

export interface Config {
  production: boolean;
  databaseUrl: string;
  port: number;
  trustProxy: number;
  sessionDays: number;
  authAttempts: number;
  serveWeb: boolean;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = Env.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`The API's environment variables have problems:\n${problems}`);
  }
  const { NODE_ENV, DATABASE_URL, PORT, TRUST_PROXY, SESSION_DAYS, AUTH_ATTEMPTS, SERVE_WEB } = parsed.data;
  const production = NODE_ENV === 'production';
  if (production && !DATABASE_URL) throw new Error('Set DATABASE_URL: production has no default database');
  return {
    production,
    databaseUrl: DATABASE_URL ?? LOCAL_DATABASE_URL,
    port: PORT,
    trustProxy: TRUST_PROXY,
    sessionDays: SESSION_DAYS,
    authAttempts: AUTH_ATTEMPTS,
    serveWeb: SERVE_WEB === undefined ? production : SERVE_WEB === 'true' || SERVE_WEB === '1',
  };
}
