import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { API } from '@lp/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Browser, startApi } from './api.ts';
import { type TestDatabase, testDatabase } from './db.ts';

let database: TestDatabase;
let api: Awaited<ReturnType<typeof startApi>>;
let browser: Browser;
let root: string;

/** A tiny stand-in for the two builds. */
function fakeBuilds() {
  root = mkdtempSync(join(tmpdir(), 'lp-web-'));
  const write = (path: string, text: string) => {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  write('site/index.html', '<h1>Home</h1>');
  write('site/tracks/react.html', '<h1>React</h1>');
  write('site/404.html', '<h1>Page not found</h1>');
  write('app/index.html', '<div id="root"></div>');
  write('app/assets/index-a1b2c3.js', 'console.log(1);');
  write('app/favicon.svg', '<svg/>');
  return { siteDir: join(root, 'site'), appDir: join(root, 'app') };
}

beforeAll(async () => {
  database = await testDatabase();
  api = await startApi({ db: database.db, web: fakeBuilds() });
  browser = api.browser();
});
afterAll(async () => {
  await api.close();
  await database.drop();
  rmSync(root, { recursive: true, force: true });
});

describe('one server for the whole domain', () => {
  it('serves the site at /, and its pages with or without .html', async () => {
    expect(await browser.get('/')).toMatchObject({ status: 200, body: '<h1>Home</h1>' });
    expect((await browser.get('/tracks/react.html')).body).toBe('<h1>React</h1>');
    expect((await browser.get('/tracks/react')).body).toBe('<h1>React</h1>');
    expect((await browser.get('/')).headers.get('cache-control')).toBe('no-cache');
  });

  it('answers a missing site page with the site’s 404 page', async () => {
    expect(await browser.get('/nowhere.html')).toMatchObject({ status: 404, body: '<h1>Page not found</h1>' });
  });

  it('serves the app at /app/, and its index for every route inside it', async () => {
    for (const path of ['/app/', '/app/tracks/react/useeffect', '/app/sign-in']) {
      const answer = await browser.get(path);
      expect(answer, path).toMatchObject({ status: 200, body: '<div id="root"></div>' });
      expect(answer.headers.get('cache-control'), path).toBe('no-cache');
    }
    const bare = await browser.get('/app');
    expect(bare.status).toBe(301);
    expect(bare.headers.get('location')).toBe('/app/');
  });

  it('lets browsers keep hashed build files for a year, and never answers a missing one with HTML', async () => {
    const script = await browser.get('/app/assets/index-a1b2c3.js');
    expect(script.status).toBe(200);
    expect(script.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect((await browser.get('/app/favicon.svg')).headers.get('cache-control')).toBe('no-cache');
    const missing = await browser.get('/app/assets/index-old.js');
    expect(missing.status).toBe(404);
    expect(missing.body).toBe('Not found\n');
  });

  it('keeps /api for the API, JSON errors included', async () => {
    expect((await browser.get(API.tracks)).status).toBe(200);
    expect(await browser.get('/api/nowhere')).toMatchObject({ status: 404, body: { error: 'No API at /api/nowhere' } });
  });

  it('sends the same strict security headers with pages as with the API', async () => {
    const { headers } = await browser.get('/app/');
    expect(headers.get('content-security-policy')).toBe(
      "default-src 'none';script-src 'self';style-src 'self';img-src 'self';font-src 'self';connect-src 'self';manifest-src 'self';form-action 'self';base-uri 'none';frame-ancestors 'none'",
    );
    expect(headers.get('x-content-type-options')).toBe('nosniff');
  });
});

describe('the health check', () => {
  it('is up while the database answers', async () => {
    expect(await browser.get(API.health)).toMatchObject({ status: 200, body: { ok: true } });
  });

  it('is down, without the details, when the database does not answer', async () => {
    const broken = await startApi({
      db: { query: () => Promise.reject(new Error('connect ECONNREFUSED')) } as never,
    });
    const quiet = console.error;
    console.error = () => {};
    const answer = await broken.browser().get(API.health);
    console.error = quiet;
    expect(answer).toMatchObject({ status: 503, body: { error: 'The database is unreachable' } });
    await broken.close();
  });
});
