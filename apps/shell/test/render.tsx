import { loadContent } from '@lp/content';
import { API } from '@lp/contracts';
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

type Fetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/** Sends one of the app's requests (a path such as /api/tracks) to the mock API. */
export const callApi = (api: MockApi, input: RequestInfo | URL, init?: RequestInit) =>
  api.handle(new Request(new URL(String(input), 'http://localhost'), init));

/**
 * Answers the app's requests from a fresh mock API, as the dev server does. `through` can stand in front of it,
 * for example to fail some requests.
 */
export function mockFetch(api: MockApi = createMockApi({ content: () => content }), through?: Fetch) {
  const fetch = vi.fn<Fetch>(through ?? ((input, init) => callApi(api, input, init)));
  vi.stubGlobal('fetch', fetch);
  return { api, fetch };
}

/** Marks topics done in the mock API, as a passed quiz would. */
export async function complete(api: MockApi, ...topics: [trackId: string, topicId: string][]) {
  for (const [trackId, topicId] of topics) {
    await api.handle(
      new Request(`http://localhost${API.topicProgress(topicId)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ trackId, score: 1 }),
      }),
    );
  }
}

function client() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

/** The whole app at `path`, with its real routes, against the mock API (or `fetch`, when given). */
export function renderApp(path: string, { api, fetch }: { api?: MockApi; fetch?: Fetch } = {}) {
  const requests = mockFetch(api, fetch);
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const view = render(
    <QueryClientProvider client={client()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...view, ...requests, router };
}

/** One component inside the platform (and the router and query client it needs). */
export function renderInPlatform(ui: ReactNode) {
  const router = createMemoryRouter([{ path: '*', element: <PlatformProvider>{ui}</PlatformProvider> }]);
  return render(
    <QueryClientProvider client={client()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}
