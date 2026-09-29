// Accounts: sign up, sign in, sign out, and who is signed in.
import { API, type Me, SignIn, SignUp, type User } from '@lp/contracts';
import { type Response, Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { Deps } from '../app.ts';
import { HttpError, methodNotAllowed, parseBody, sendError } from '../http.ts';
import { dummyHash, hashPassword, verifyPassword } from '../passwords.ts';
import { createSession, deleteSession, SESSION_COOKIE, sessionCookie } from '../sessions.ts';
import { route } from './content.ts';

const WINDOW_MS = 15 * 60 * 1000;

export function accountRoutes(deps: Deps): Router {
  const { db, production, sessionDays, now } = deps;
  const router = Router();

  // Per address: guessing passwords, or making accounts in bulk, soon hits a wall of 429s.
  const limiter = (message: string, skipSuccessfulRequests: boolean) =>
    rateLimit({
      windowMs: WINDOW_MS,
      limit: deps.authAttempts,
      skipSuccessfulRequests,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler: (_req, res, _next, options) => {
        const retryMinutes = Math.ceil(options.windowMs / 60_000);
        sendError(res, options.statusCode, { error: `${message} Try again in ${retryMinutes} minutes.` });
      },
    });
  // Only failed sign-ins count, so people who type their password right are never slowed down.
  const signInLimit = limiter('Too many sign-in attempts from your network.', true);
  const signUpLimit = limiter('Too many new accounts from your network.', false);

  /** Starts a session for `user`, replacing any the browser already had, and answers with Me. */
  async function signIn(res: Response, user: User, status: number) {
    if (res.locals.sessionToken) await deleteSession(db, res.locals.sessionToken);
    const { token, expires } = await createSession(db, user.id, sessionDays, now());
    res.cookie(SESSION_COOKIE, token, sessionCookie(production, expires));
    res.status(status).json({ user } satisfies Me);
  }

  router
    .route(route(API.me))
    .get((_req, res) => {
      res.json({ user: res.locals.user } satisfies Me);
    })
    .all(methodNotAllowed('GET'));

  router
    .route(route(API.signUp))
    .post(signUpLimit, async (req, res) => {
      const { name, email, password } = parseBody(SignUp, req.body);
      const { rows } = await db.query<User>(
        `INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3)
         ON CONFLICT (email) DO NOTHING
         RETURNING id, name, email`,
        [email, name, await hashPassword(password)],
      );
      const user = rows[0];
      if (!user) {
        throw new HttpError(409, 'There is already an account with this email', {
          fields: { email: 'There is already an account with this email. Sign in instead.' },
        });
      }
      await signIn(res, user, 201);
    })
    .all(methodNotAllowed('POST'));

  router
    .route(route(API.signIn))
    .post(signInLimit, async (req, res) => {
      const { email, password } = parseBody(SignIn, req.body);
      const { rows } = await db.query<User & { password_hash: string }>(
        'SELECT id, name, email, password_hash FROM users WHERE email = $1',
        [email],
      );
      const found = rows[0];
      // Check a password either way, so an unknown email takes as long to refuse as a wrong password.
      const matches = await verifyPassword(password, found?.password_hash ?? (await dummyHash()));
      if (!found || !matches) throw new HttpError(401, 'That email and password do not match an account');
      await signIn(res, { id: found.id, name: found.name, email: found.email }, 200);
    })
    .all(methodNotAllowed('POST'));

  router
    .route(route(API.signOut))
    .post(async (_req, res) => {
      if (res.locals.sessionToken) await deleteSession(db, res.locals.sessionToken);
      res.clearCookie(SESSION_COOKIE, sessionCookie(production));
      res.status(204).end();
    })
    .all(methodNotAllowed('POST'));

  return router;
}
