import { API, type Me } from '@lp/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { learner, startApi } from './api.ts';
import { type TestDatabase, testDatabase } from './db.ts';

let database: TestDatabase;
let api: Awaited<ReturnType<typeof startApi>>;

beforeAll(async () => {
  database = await testDatabase();
  api = await startApi({ db: database.db, authAttempts: 100 }); // the limit has a test of its own
});
afterAll(async () => {
  await api.close();
  await database.drop();
});

describe('signing up', () => {
  it('creates the account, signs it in, and never stores or returns the password', async () => {
    const browser = api.browser();
    const details = learner();
    const answer = await browser.post<Me>(API.signUp, { ...details, email: `  ${details.email.toUpperCase()} ` });
    expect(answer.status).toBe(201);
    expect(answer.body.user).toEqual({ id: expect.any(String), name: 'Asha Rao', email: details.email });
    expect(JSON.stringify(answer.body)).not.toContain(details.password);
    expect((await browser.get<Me>(API.me)).body.user?.email).toBe(details.email);

    const { rows } = await database.db.query('SELECT password_hash FROM users WHERE email = $1', [details.email]);
    expect(rows[0].password_hash).toMatch(/^scrypt\$32768\$8\$3\$[\w-]{22}\$[\w-]{43}$/);
  });

  it('sets a session cookie that page scripts cannot read and other sites cannot send', async () => {
    const answer = await api.browser().post(API.signUp, learner());
    const cookie = answer.headers.getSetCookie()[0] ?? '';
    expect(cookie).toMatch(/^lp_session=[\w-]{43}; Path=\/; Expires=.+; HttpOnly; SameSite=Lax$/);
    // The database keeps only the token's hash.
    const token = cookie.split(';')[0]?.split('=')[1] ?? '';
    const { rows } = await database.db.query('SELECT token_hash FROM sessions');
    expect(rows.map((r) => r.token_hash.toString('base64url'))).not.toContain(token);
  });

  it('marks the cookie Secure in production', async () => {
    const production = await startApi({ db: database.db, production: true });
    const answer = await production.browser().post(API.signUp, learner());
    expect(answer.headers.getSetCookie()[0]).toMatch(/; Secure;/);
    await production.close();
  });

  it('refuses an email that already has an account, however it is typed', async () => {
    const details = learner();
    await api.browser().post(API.signUp, details);
    const again = await api.browser().post(API.signUp, { ...details, email: details.email.toUpperCase() });
    expect(again.status).toBe(409);
    expect(again.body.fields).toEqual({ email: 'There is already an account with this email. Sign in instead.' });
  });

  it('names each field’s problem', async () => {
    const answer = await api.browser().post(API.signUp, { name: ' ', email: 'not-an-email', password: 'short' });
    expect(answer.status).toBe(400);
    expect(answer.body).toEqual({
      error: 'Check the highlighted fields and try again',
      fields: {
        name: 'Enter your name',
        email: 'Enter an email address like name@example.com',
        password: 'Use at least 8 characters',
      },
    });
    const extra = await api.browser().post(API.signUp, { ...learner(), role: 'admin' });
    expect(extra.status).toBe(400); // unknown fields are refused, not ignored
  });
});

describe('signing in and out', () => {
  it('signs in with the right password, and out again', async () => {
    const details = learner();
    await api.browser().post(API.signUp, details);

    const browser = api.browser();
    const answer = await browser.post<Me>(API.signIn, {
      email: details.email.toUpperCase(),
      password: details.password,
    });
    expect(answer.status).toBe(200);
    expect(answer.body.user?.email).toBe(details.email);
    expect((await browser.get<Me>(API.me)).body.user?.name).toBe('Asha Rao');

    const out = await browser.post(API.signOut);
    expect(out.status).toBe(204);
    expect(out.headers.getSetCookie()[0]).toMatch(/^lp_session=; Path=\/; Expires=Thu, 01 Jan 1970/);
    expect((await browser.get<Me>(API.me)).body).toEqual({ user: null });
  });

  it('ends the session on the server too, so a copied cookie stops working', async () => {
    const browser = api.browser();
    await browser.post(API.signUp, learner());
    const copy = api.browser();
    for (const [k, v] of browser.cookies) copy.cookies.set(k, v);
    await browser.post(API.signOut);
    expect((await copy.get<Me>(API.me)).body).toEqual({ user: null });
  });

  it('gives the same answer for a wrong password and an unknown email', async () => {
    const details = learner();
    await api.browser().post(API.signUp, details);
    const wrong = await api.browser().post(API.signIn, { email: details.email, password: 'not the password' });
    const unknown = await api.browser().post(API.signIn, { email: 'nobody@example.com', password: details.password });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
    expect(wrong.body).toEqual({ error: 'That email and password do not match an account' });
  });

  it('forgets an expired session', async () => {
    const browser = api.browser();
    await browser.post(API.signUp, learner());
    await database.db.query("UPDATE sessions SET expires_at = now() - interval '1 second'");
    expect((await browser.get<Me>(API.me)).body).toEqual({ user: null });
  });
});

describe('guessing passwords', () => {
  it('is cut off after a few failures from one address, while right answers never count', async () => {
    const limited = await startApi({ db: database.db, authAttempts: 3 });
    const details = learner();
    await limited.browser().post(API.signUp, details);
    const attempt = (password: string) => limited.browser().post(API.signIn, { email: details.email, password });

    expect((await attempt(details.password)).status).toBe(200);
    for (let i = 0; i < 3; i++) expect((await attempt('guess')).status).toBe(401);
    const blocked = await attempt(details.password);
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toBe('Too many sign-in attempts from your network. Try again in 15 minutes.');
    // The standard RateLimit headers tell clients the policy: 3 per 900-second window.
    expect(blocked.headers.get('ratelimit-policy')).toContain('q=3; w=900');
    await limited.close();
  });
});
