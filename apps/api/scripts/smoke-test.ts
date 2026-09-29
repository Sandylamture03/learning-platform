// `pnpm smoke http://localhost:3000`: checks a running platform (the Docker image, or production)
// end to end. The site, the app and the API answer from one origin, pages carry the security headers, and a new
// learner can sign up, save progress and sign out. Exits with 1 on the first failure.
import { API, APP_BASE } from '@lp/contracts';

const base = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '');
let passed = 0;

function check(condition: unknown, what: string): asserts condition {
  if (!condition) throw new Error(`Smoke test failed: ${what}`);
  passed++;
}

async function get(path: string, init?: RequestInit) {
  const response = await fetch(base + path, { redirect: 'manual', ...init });
  return { response, text: await response.text() };
}

/** Waits for the server to come up and reach its database, as the host's health check does. */
async function waitForHealth() {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      if ((await fetch(base + API.health)).ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Smoke test failed: ${base}${API.health} never answered ok`);
}

await waitForHealth();

const home = await get('/');
check(home.response.status === 200 && home.text.includes('<h1'), 'the site answers at /');
const csp = home.response.headers.get('content-security-policy') ?? '';
check(csp.includes("default-src 'none'") && csp.includes("script-src 'self'"), 'pages carry the strict CSP');
check(home.response.headers.get('x-content-type-options') === 'nosniff', 'pages carry nosniff');

const app = await get(`${APP_BASE}tracks/react`);
check(app.response.status === 200 && app.text.includes('<div id="root">'), 'a deep link into the app gets the app');
const script = /src="(\/app\/assets\/[^"]+\.js)"/.exec(app.text)?.[1];
check(script, "the app's page links its script under /app/assets/");
const asset = await get(script);
check(asset.response.status === 200, "the app's script loads");
check(asset.response.headers.get('cache-control')?.includes('immutable'), 'hashed files are cached for good');

const missing = await get('/no-such-page.html');
check(missing.response.status === 404 && missing.text.includes('<h1'), 'a missing page gets the site’s 404 page');

const tracks = await get(API.tracks);
check(tracks.response.status === 200 && JSON.parse(tracks.text).length === 5, 'the API lists the five tracks');

const json = { 'content-type': 'application/json' };
const email = `smoke-${Date.now()}@example.com`;
const signUp = await get(API.signUp, {
  method: 'POST',
  headers: json,
  body: JSON.stringify({ name: 'Smoke Test', email, password: 'a long enough password' }),
});
check(signUp.response.status === 201, `sign-up answers 201 (got ${signUp.response.status}: ${signUp.text})`);
const cookie = signUp.response.headers.getSetCookie()[0] ?? '';
check(/HttpOnly/i.test(cookie) && /SameSite=Lax/i.test(cookie), 'the session cookie is HttpOnly and SameSite=Lax');
if (process.env.EXPECT_SECURE_COOKIE) check(/;\s*Secure/i.test(cookie), 'the session cookie is Secure');
const session = { cookie: cookie.split(';')[0] ?? '' };

const saved = await get(API.topicProgress('auth'), {
  method: 'PUT',
  headers: { ...json, ...session },
  body: JSON.stringify({ trackId: 'nodejs', score: 1 }),
});
check(saved.response.status === 200, 'a signed-in learner can save progress');
const progress = await get(API.progress, { headers: session });
check(JSON.parse(progress.text).completed.length === 1, 'the progress comes back from the database');

const out = await get(API.signOut, { method: 'POST', headers: { ...json, ...session }, body: '{}' });
check(out.response.status === 204, 'sign-out answers 204');
check((await get(API.progress, { headers: session })).response.status === 401, 'the old cookie no longer works');

console.log(`Smoke test passed: ${passed} checks against ${base}`);
