// The Express app, without a port or a real database, so tests can build one around a throwaway schema.
import type { Content, User } from '@lp/contracts';
import express from 'express';
import helmet from 'helmet';
import type { Pool } from 'pg';
import { errorHandler, HttpError, requireJsonWrites } from './http.ts';
import { accountRoutes } from './routes/accounts.ts';
import { contentRoutes } from './routes/content.ts';
import { progressRoutes } from './routes/progress.ts';
import { waitlistRoutes } from './routes/waitlist.ts';
import { findSessionUser, readCookie, SESSION_COOKIE } from './sessions.ts';

declare global {
  namespace Express {
    interface Locals {
      /** Who the session cookie signs in, or null. */
      user: User | null;
      /** The session token from the cookie, when there is one. */
      sessionToken: string | undefined;
    }
  }
}

export interface AppOptions {
  db: Pool;
  content: Content;
  /** Where the content files are, for the lesson theory and challenge code. */
  dataDir?: string;
  production?: boolean;
  trustProxy?: number;
  sessionDays?: number;
  /** Failed sign-ins, and sign-ups, allowed per address in each 15 minutes. */
  authAttempts?: number;
  /** The clock, for sessions and completedAt. */
  now?: () => Date;
}

export type Deps = Required<Omit<AppOptions, 'dataDir'>> & Pick<AppOptions, 'dataDir'>;

export function createApp(options: AppOptions): express.Express {
  const deps: Deps = {
    production: false,
    trustProxy: 0,
    sessionDays: 30,
    authAttempts: 20,
    now: () => new Date(),
    ...options,
  };
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', deps.trustProxy);
  app.use(helmet());
  app.use('/api', (_req, res, next) => {
    // Answers depend on who is signed in, so no cache may keep them.
    res.set('cache-control', 'no-store');
    next();
  });

  // The waitlist is the site's plain HTML form, so it takes a form body; everything after it takes JSON.
  app.use('/api', waitlistRoutes(deps));
  app.use('/api', requireJsonWrites, express.json({ limit: '10kb' }));
  app.use('/api', async (req, res, next) => {
    const token = readCookie(req.headers.cookie, SESSION_COOKIE);
    res.locals.sessionToken = token;
    res.locals.user = token ? await findSessionUser(deps.db, token, deps.now()) : null;
    next();
  });
  app.use('/api', contentRoutes(deps), accountRoutes(deps), progressRoutes(deps));
  app.use('/api', (req) => {
    throw new HttpError(404, `No API at ${req.path === '/' ? '/api' : `/api${req.path}`}`);
  });
  app.use(errorHandler);
  return app;
}
