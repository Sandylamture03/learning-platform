import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadProfile } from './solution.js';

const USER = { id: 7, name: 'Asha' };
const POSTS = [{ id: 1, title: 'Closures' }];

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** A fake API: answers each URL from `routes`, and 404 for anything else. */
function fakeApi(routes) {
  const fetch = vi.fn(async (url) => routes[String(url)]?.() ?? json({ error: 'Not found' }, 404));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

describe('loadProfile', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the user and their posts, parsed from JSON', async () => {
    fakeApi({
      '/api/users/7': () => json(USER),
      '/api/users/7/posts': () => json(POSTS),
    });
    await expect(loadProfile(7)).resolves.toEqual({ user: USER, posts: POSTS });
  });

  it('starts both requests before either one finishes', async () => {
    const answers = [];
    const fetch = vi.fn(
      (url) =>
        new Promise((resolve) => {
          answers.push(() => resolve(json(String(url).endsWith('/posts') ? POSTS : USER)));
        }),
    );
    vi.stubGlobal('fetch', fetch);

    const profile = loadProfile(7);
    // Let any awaits in loadProfile run, but answer no request yet.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetch.mock.calls.map(([url]) => String(url)).sort()).toEqual(['/api/users/7', '/api/users/7/posts']);

    for (const answer of answers) answer();
    await expect(profile).resolves.toEqual({ user: USER, posts: POSTS });
  });

  it('throws a clear error when the user does not exist', async () => {
    fakeApi({ '/api/users/9/posts': () => json([]) });
    await expect(loadProfile(9)).rejects.toThrow('Request failed: 404 /api/users/9');
  });

  it('throws a clear error when the posts request fails', async () => {
    fakeApi({
      '/api/users/7': () => json(USER),
      '/api/users/7/posts': () => json({ error: 'Server error' }, 500),
    });
    await expect(loadProfile(7)).rejects.toThrow('Request failed: 500 /api/users/7/posts');
  });

  it('lets a network error through', async () => {
    const offline = new TypeError('Failed to fetch');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw offline;
      }),
    );
    await expect(loadProfile(7)).rejects.toBe(offline);
  });
});
