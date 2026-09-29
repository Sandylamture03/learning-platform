import { lessonView, quizData, resourceCatalogue, trackSummaries, trackView } from '@lp/content';
import { API } from '@lp/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Browser, content, startApi } from './api.ts';
import { type TestDatabase, testDatabase } from './db.ts';

let database: TestDatabase;
let api: Awaited<ReturnType<typeof startApi>>;
let browser: Browser;

beforeAll(async () => {
  database = await testDatabase();
  api = await startApi({ db: database.db });
  browser = api.browser();
});
afterAll(async () => {
  await api.close();
  await database.drop();
});

describe('the content', () => {
  it('answers with the same views the site and the mock use', async () => {
    expect((await browser.get(API.tracks)).body).toEqual(trackSummaries(content));
    expect((await browser.get(API.track('react'))).body).toEqual(trackView(content, 'react'));
    expect((await browser.get(API.lesson('useeffect'))).body).toEqual(lessonView(content, 'useeffect'));
    expect((await browser.get(API.quiz('narrowing'))).body).toEqual(quizData(content, 'narrowing'));
    expect((await browser.get(API.resources)).body).toEqual(resourceCatalogue(content));
  });

  it('answers 404, with the reason, for what does not exist', async () => {
    expect(await browser.get(API.track('cobol'))).toMatchObject({
      status: 404,
      body: { error: 'No track called "cobol"' },
    });
    expect((await browser.get(API.lesson('this-and-classes'))).status).toBe(404); // an outline has no lesson
    expect((await browser.get(API.quiz('nothing'))).body).toEqual({ error: 'No quiz for "nothing"' });
    expect((await browser.get('/api/nothing/here')).body).toEqual({ error: 'No API at /api/nothing/here' });
  });

  it('answers 405 with the methods a path allows', async () => {
    const answer = await browser.post(API.tracks, {});
    expect(answer.status).toBe(405);
    expect(answer.headers.get('allow')).toBe('GET');
    expect(answer.body).toEqual({ error: 'POST is not allowed here; use GET' });
  });
});

describe('every answer', () => {
  it('is never cached, and carries helmet’s security headers', async () => {
    const { headers } = await browser.get(API.tracks);
    expect(headers.get('cache-control')).toBe('no-store');
    expect(headers.get('x-content-type-options')).toBe('nosniff');
    expect(headers.get('content-security-policy')).toContain("default-src 'self'");
    expect(headers.get('x-powered-by')).toBeNull();
  });
});

describe('a write', () => {
  it('must be JSON, which keeps other sites’ forms from acting for a learner', async () => {
    const form = await browser.send('POST', API.signIn, 'email=a%40b.c&password=x', {
      'content-type': 'application/x-www-form-urlencoded',
    });
    expect(form).toMatchObject({
      status: 415,
      body: { error: 'Send a JSON body, with Content-Type: application/json' },
    });
  });

  it('says so when the JSON is broken or too large', async () => {
    expect((await browser.send('POST', API.signIn, '{"email":')).body).toEqual({ error: 'The body is not valid JSON' });
    const large = await browser.post(API.signIn, { email: 'a@b.co', password: 'x'.repeat(20_000) });
    expect(large).toMatchObject({ status: 413, body: { error: 'The body is too large' } });
  });
});
