import { mkdtempSync, rmSync } from 'node:fs';
import { request as httpRequest, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildSite } from '../src/build.ts';
import { createSiteServer } from '../src/server.ts';

let server: Server;
let base: string;
let outDir: string;
const signups: unknown[] = [];

beforeAll(async () => {
  ({ outDir } = buildSite({ outDir: mkdtempSync(join(tmpdir(), 'lp-serve-')) }));
  server = createSiteServer({ root: outDir, trackIds: ['html-css', 'react'], onSignup: (s) => signups.push(s) });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  base = `http://localhost:${(server.address() as AddressInfo).port}`;
});
afterAll(() => {
  server.close();
  rmSync(outDir, { recursive: true, force: true });
});

const form = new URLSearchParams({
  name: 'Asha',
  email: 'asha@example.com',
  track: 'react',
  level: 'some',
  hoursPerWeek: '10',
  updates: 'yes',
});

function post(body: string, type = 'application/x-www-form-urlencoded') {
  return fetch(`${base}/api/waitlist`, { method: 'POST', body, headers: { 'Content-Type': type }, redirect: 'manual' });
}

/** A raw request, so the path reaches the server exactly as written (fetch would normalise it). */
function rawGet(path: string): Promise<number> {
  return new Promise((resolve, reject) => {
    httpRequest(`${base}${path}`, (res) => {
      res.resume();
      resolve(res.statusCode ?? 0);
    })
      .on('error', reject)
      .end();
  });
}

describe('the site server', () => {
  it('serves pages with a strict security policy: scripts from this origin only, nothing inline', async () => {
    const res = await fetch(`${base}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8');
    const policy = res.headers.get('content-security-policy') ?? '';
    expect(policy).toContain("default-src 'none'");
    expect(policy).toContain("script-src 'self';");
    expect(policy).not.toContain('unsafe-');
  });

  it('serves the widget modules and their data with types the browser accepts', async () => {
    const module = await fetch(`${base}/assets/widgets/quiz.js`);
    expect(module.status).toBe(200);
    expect(module.headers.get('content-type')).toBe('text/javascript; charset=utf-8');
    const data = await fetch(`${base}/data/quizzes/event-loop.json`);
    expect(data.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect((await data.json()).topic.id).toBe('event-loop');
  });

  it('redirects a folder to its index page', async () => {
    const res = await fetch(`${base}/tracks`, { redirect: 'manual' });
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('/tracks/');
  });

  it('answers missing pages with the 404 page', async () => {
    const res = await fetch(`${base}/no-such-page.html`);
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('<h1>Page not found</h1>');
  });

  it('never serves files outside dist/', async () => {
    expect(await rawGet('/..%2f..%2fpackage.json')).toBe(404);
    expect(await rawGet('/%2e%2e/%2e%2e/package.json')).toBe(404);
  });

  it('accepts a valid sign-up and redirects to the thank-you page', async () => {
    const res = await post(form.toString());
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/thanks.html');
    expect(signups).toEqual([{ track: 'react', level: 'some', hoursPerWeek: 10 }]);
  });

  it('rejects an invalid sign-up with the reasons', async () => {
    const bad = new URLSearchParams(form);
    bad.set('email', 'asha');
    bad.set('track', 'cobol');
    const res = await post(bad.toString());
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('email: Enter an email address like name@example.com');
  });

  it('only takes form posts', async () => {
    expect((await post(JSON.stringify({ name: 'Asha' }), 'application/json')).status).toBe(415);
    expect((await fetch(`${base}/api/waitlist`)).status).toBe(405);
  });
});
