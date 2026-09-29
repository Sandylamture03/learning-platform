// @vitest-environment happy-dom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UserCard } from './solution.jsx';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const USERS = { 1: { id: 1, name: 'Asha Rao' }, 2: { id: 2, name: 'Ben Okafor' } };

/** A fake network: every request waits until the test answers it, and an abort rejects it as fetch would. */
function fakeNetwork() {
  const requests = [];
  const fetch = vi.fn(
    (url, { signal } = {}) =>
      new Promise((resolve, reject) => {
        const request = { url, signal, resolve, reject };
        requests.push(request);
        signal?.addEventListener('abort', () => reject(new DOMException('The request was aborted', 'AbortError')));
      }),
  );
  vi.stubGlobal('fetch', fetch);
  const answer = async (url, status = 200) => {
    const request = requests.find((r) => r.url === url);
    const id = Number(url.split('/').pop());
    await act(async () => request.resolve(new Response(JSON.stringify(USERS[id] ?? {}), { status })));
  };
  return { fetch, requests, answer };
}

describe('UserCard', () => {
  it('shows a loading message, then the user’s name', async () => {
    const { answer } = fakeNetwork();
    render(<UserCard userId={1} />);
    expect(screen.getByRole('status').textContent).toBe('Loading…');
    await answer('/api/users/1');
    expect(screen.getByRole('heading').textContent).toBe('Asha Rao');
  });

  it('shows an error when the response is not ok', async () => {
    const { answer } = fakeNetwork();
    render(<UserCard userId={9} />);
    await answer('/api/users/9', 404);
    expect(screen.getByRole('alert').textContent).toBe('Could not load user 9.');
  });

  it('aborts the old request when userId changes', async () => {
    const { requests } = fakeNetwork();
    const { rerender } = render(<UserCard userId={1} />);
    rerender(<UserCard userId={2} />);
    expect(requests.map((r) => r.url)).toEqual(['/api/users/1', '/api/users/2']);
    expect(requests[0].signal?.aborted).toBe(true);
    expect(requests[1].signal?.aborted).toBe(false);
  });

  it('never shows an old user after a newer one, whatever order the answers arrive in', async () => {
    const { answer } = fakeNetwork();
    const { rerender } = render(<UserCard userId={1} />);
    rerender(<UserCard userId={2} />);
    expect(screen.getByRole('status').textContent).toBe('Loading…');
    await answer('/api/users/2');
    await answer('/api/users/1');
    expect(screen.getByRole('heading').textContent).toBe('Ben Okafor');
  });

  it('aborts its request when it leaves the page', () => {
    const { requests } = fakeNetwork();
    const { unmount } = render(<UserCard userId={1} />);
    unmount();
    expect(requests[0].signal?.aborted).toBe(true);
  });
});
