import { loadContent } from '@lp/content';
import { API, type Me, type User } from '@lp/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { vi } from 'vitest';
import { createMockApi, type MockApi } from '../mock-api/handler.ts';
import { PlatformProvider } from '../src/platform.tsx';
import { routes } from '../src/routes.tsx';

const content = loadContent();

export type Fetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
/** Stands in front of the mock API; `next` sends a request on to it, with the browser's cookies. */
export type Through = (input: RequestInfo | URL, init: RequestInit | undefined, next: Fetch) => Promise<Response>;

/** Sends one request (a path such as /api/tracks) to the mock API, with the Cookie header given. */
export const callApi = (api: MockApi, input: RequestInfo | URL, init?: RequestInit, cookies?: string) =>
  api.handle(new Request(new URL(String(input), 'http://localhost'), init), cookies);

let learners = 0;

/**
 * Answers the app's requests from a fresh mock API, as the dev server does, keeping its cookies the way a
 * browser would. `through` can stand in front of it, for example to fail some requests.
 */
export function mockFetch(through?: Through) {
  const cookies = new Map<string, string>();
  const api = createMockApi({
    content: () => content,
    onSetCookie: (cookie) => {
      const [pair = ''] = cookie.split(';');
      const [name = '', value = ''] = pair.split('=');
      if (value) cookies.set(name, value);
      else cookies.delete(name);
    },
  });
  const viaApi: Fetch = (input, init) =>
    callApi(api, input, init, [...cookies].map(([k, v]) => `${k}=${v}`).join('; ') || undefined);
  const fetch = vi.fn<Fetch>(through ? (input, init) => through(input, init, viaApi) : viaApi);
  vi.stubGlobal('fetch', fetch);

  const send = (path: string, method: string, body: unknown) =>
    fetch(path, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

  return {
    api,
    fetch,
    cookies,
    /** Makes a new account and signs this browser in, as the sign-up page would. */
    async signUp(name = 'Asha Rao'): Promise<User> {
      const email = `learner${++learners}@example.com`;
      const response = await send(API.signUp, 'POST', { name, email, password: 'correct horse battery' });
      const { user } = (await response.json()) as Me;
      if (!user) throw new Error(`Sign-up failed: ${response.status}`);
      return user;
    },
    /** Marks topics done for the signed-in learner, as a passed quiz would. */
    async complete(...topics: [trackId: string, topicId: string][]) {
      for (const [trackId, topicId] of topics) {
        const response = await send(API.topicProgress(topicId), 'PUT', { trackId, score: 1 });
        if (!response.ok) throw new Error(`Could not complete ${topicId}: ${response.status}`);
      }
    },
  };
}

export type Requests = ReturnType<typeof mockFetch>;

function client() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

/**
 * The whole app at `path`, with its real routes, against the mock API. Pass `requests` from mockFetch to set up
 * an account or progress first, or `through` to stand in front of the API.
 */
export function renderApp(path: string, { requests, through }: { requests?: Requests; through?: Through } = {}) {
  const used = requests ?? mockFetch(through);
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const view = render(
    <QueryClientProvider client={client()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...view, ...used, router };
}

/** One component inside the platform (and the router and query client it needs). */
export function renderInPlatform(ui: ReactNode) {
  mockFetch();
  const router = createMemoryRouter([{ path: '*', element: <PlatformProvider>{ui}</PlatformProvider> }]);
  return render(
    <QueryClientProvider client={client()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}
