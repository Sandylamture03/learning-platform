import { WAITLIST_ENDPOINT } from '@lp/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startApi } from './api.ts';
import { type TestDatabase, testDatabase } from './db.ts';

let database: TestDatabase;
let api: Awaited<ReturnType<typeof startApi>>;

beforeAll(async () => {
  database = await testDatabase();
  api = await startApi({ db: database.db });
});
afterAll(async () => {
  await api.close();
  await database.drop();
});

const form = (fields: Record<string, string>) =>
  api.browser().send('POST', WAITLIST_ENDPOINT, new URLSearchParams(fields).toString(), {
    'content-type': 'application/x-www-form-urlencoded',
  });

const valid = {
  name: 'Asha Rao',
  email: 'Asha@Example.com',
  track: 'react',
  level: 'some',
  hoursPerWeek: '6',
  updates: 'yes',
};

describe('the waitlist', () => {
  it('stores a sign-up from the site’s form and sends the browser to the thank-you page', async () => {
    const answer = await form(valid);
    expect(answer.status).toBe(303);
    expect(answer.headers.get('location')).toBe('/thanks.html');
    const { rows } = await database.db.query('SELECT email, name, track, level, hours_per_week FROM waitlist');
    expect(rows).toEqual([
      { email: 'asha@example.com', name: 'Asha Rao', track: 'react', level: 'some', hours_per_week: 6 },
    ]);
  });

  it('updates the sign-up when the same person signs up again', async () => {
    await form({ ...valid, email: 'sam@example.com', track: 'nodejs' });
    await form({ ...valid, email: 'SAM@example.com', track: 'typescript', hoursPerWeek: '10' });
    const { rows } = await database.db.query(
      "SELECT track, hours_per_week FROM waitlist WHERE email = 'sam@example.com'",
    );
    expect(rows).toEqual([{ track: 'typescript', hours_per_week: 10 }]);
  });

  it('explains what is wrong with a form that fails the checks, and stores nothing', async () => {
    const answer = await form({ ...valid, email: 'nobody-new@nowhere', track: 'cobol' });
    expect(answer.status).toBe(400);
    expect(answer.headers.get('content-type')).toMatch(/^text\/plain/);
    expect(answer.body).toContain('email: Enter an email address like name@example.com');
    expect(answer.body).toContain('track: Choose a track');
    const { rows } = await database.db.query("SELECT 1 FROM waitlist WHERE email LIKE 'nobody-new%'");
    expect(rows).toHaveLength(0);
  });

  it('takes only a form post', async () => {
    const json = await api.browser().post(WAITLIST_ENDPOINT, valid);
    expect(json.status).toBe(415);
    const get = await api.browser().get(WAITLIST_ENDPOINT);
    expect(get).toMatchObject({ status: 405, body: { error: 'GET is not allowed here; use POST' } });
  });
});
