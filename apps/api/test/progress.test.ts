import { API, type Progress, type TopicProgress } from '@lp/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Browser, learner, startApi } from './api.ts';
import { type TestDatabase, testDatabase } from './db.ts';

let database: TestDatabase;
let api: Awaited<ReturnType<typeof startApi>>;
// A clock the tests move forward, so completedAt is predictable.
let clock = Date.parse('2026-09-29T09:00:00Z');
const tick = () => {
  clock += 60_000;
  return new Date(clock);
};

beforeAll(async () => {
  database = await testDatabase();
  api = await startApi({ db: database.db, now: tick });
});
afterAll(async () => {
  await api.close();
  await database.drop();
});

async function signedIn(): Promise<Browser> {
  const browser = api.browser();
  expect((await browser.post(API.signUp, learner())).status).toBe(201);
  return browser;
}

describe('progress', () => {
  it('needs a signed-in learner', async () => {
    const browser = api.browser();
    expect(await browser.get(API.progress)).toMatchObject({
      status: 401,
      body: { error: 'Sign in to see your progress' },
    });
    const put = await browser.put(API.topicProgress('event-loop'), { trackId: 'javascript', score: 1 });
    expect(put).toMatchObject({ status: 401, body: { error: 'Sign in to save your progress' } });
  });

  it('records finished topics, oldest first, and moves one to the end when it is finished again', async () => {
    const browser = await signedIn();
    const first = await browser.put<TopicProgress>(API.topicProgress('scope-and-closures'), {
      trackId: 'javascript',
      score: 0.8,
    });
    expect(first.body).toEqual({
      topicId: 'scope-and-closures',
      trackId: 'javascript',
      score: 0.8,
      completedAt: expect.stringMatching(/^2026-09-29T09:\d\d:00\.000Z$/),
    });
    await browser.put(API.topicProgress('useeffect'), { trackId: 'react', score: 1 });
    await browser.put(API.topicProgress('scope-and-closures'), { trackId: 'javascript', score: 1 });

    const { body } = await browser.get<Progress>(API.progress);
    expect(body.completed.map((p) => [p.topicId, p.score])).toEqual([
      ['useeffect', 1],
      ['scope-and-closures', 1],
    ]);
  });

  it('keeps each learner’s progress to themselves', async () => {
    const asha = await signedIn();
    const sam = await signedIn();
    await asha.put(API.topicProgress('narrowing'), { trackId: 'typescript', score: 0.8 });
    expect((await sam.get<Progress>(API.progress)).body).toEqual({ completed: [] });
    expect((await asha.get<Progress>(API.progress)).body.completed).toHaveLength(1);
  });

  it('survives signing out and in again, because it lives in the database', async () => {
    const browser = api.browser();
    const details = learner();
    await browser.post(API.signUp, details);
    await browser.put(API.topicProgress('async-code'), { trackId: 'javascript', score: 0.8 });
    await browser.post(API.signOut);
    await browser.post(API.signIn, { email: details.email, password: details.password });
    expect((await browser.get<Progress>(API.progress)).body.completed.map((p) => p.topicId)).toEqual(['async-code']);
  });

  it('checks the update at the edge', async () => {
    const browser = await signedIn();
    const bad = await browser.put(API.topicProgress('event-loop'), { trackId: 'javascript', score: 2 });
    expect(bad).toMatchObject({ status: 400, body: { fields: { score: expect.any(String) } } });
    const wrongTrack = await browser.put(API.topicProgress('event-loop'), { trackId: 'react', score: 1 });
    expect(wrongTrack).toMatchObject({ status: 404, body: { error: 'No topic "event-loop" in track "react"' } });
  });

  it('goes when the account goes', async () => {
    const browser = await signedIn();
    await browser.put(API.topicProgress('event-loop'), { trackId: 'javascript', score: 1 });
    const { rows } = await database.db.query(
      'DELETE FROM users WHERE id = (SELECT user_id FROM progress LIMIT 1) RETURNING id',
    );
    const left = await database.db.query('SELECT count(*)::int AS n FROM progress WHERE user_id = $1', [rows[0].id]);
    expect(left.rows[0].n).toBe(0);
  });
});
