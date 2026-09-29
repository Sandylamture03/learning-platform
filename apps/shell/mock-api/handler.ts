// The mock API: the Phase 4 Node.js API's paths and shapes (@lp/contracts' API), answered from the content files,
// with progress kept in memory. It is a fetch-style handler, Request in and Response out, so the Vite dev and
// preview servers can serve it (plugin.ts) and tests can call it in place of fetch.
import { DATA_DIR, lessonView, loadContent, quizData, resourceCatalogue, trackSummaries, trackView } from '@lp/content';
import { type ApiError, type Content, type Progress, ProgressUpdate, type TopicProgress } from '@lp/contracts';

export interface MockApiOptions {
  /** Returns the content to serve; called on every request, so it can reload after an edit. */
  content?: () => Content;
  dataDir?: string;
  /** Waits this long before answering, so loading states show up in development. */
  delayMs?: number;
  /** The clock, for completedAt. */
  now?: () => Date;
}

export interface MockApi {
  handle(request: Request): Promise<Response>;
  /** Forgets all progress. */
  reset(): void;
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
const problem = (status: number, error: string, headers?: Record<string, string>) =>
  json(status, { error } satisfies ApiError, headers);
const found = (body: unknown, what: string) => (body === undefined ? problem(404, what) : json(200, body));

type Route = [
  method: string,
  pattern: RegExp,
  answer: (params: string[], request: Request) => Promise<Response> | Response,
];

export function createMockApi({
  content = loadContent,
  dataDir = DATA_DIR,
  delayMs = 0,
  now = () => new Date(),
}: MockApiOptions = {}): MockApi {
  const progress = new Map<string, TopicProgress>();

  const routes: Route[] = [
    ['GET', /^\/api\/tracks$/, () => json(200, trackSummaries(content()))],
    ['GET', /^\/api\/tracks\/([a-z0-9-]+)$/, ([id = '']) => found(trackView(content(), id), `No track called "${id}"`)],
    [
      'GET',
      /^\/api\/lessons\/([a-z0-9-]+)$/,
      ([id = '']) => found(lessonView(content(), id, dataDir), `No lesson for "${id}"`),
    ],
    ['GET', /^\/api\/quizzes\/([a-z0-9-]+)$/, ([id = '']) => found(quizData(content(), id), `No quiz for "${id}"`)],
    ['GET', /^\/api\/resources$/, () => json(200, resourceCatalogue(content()))],
    ['GET', /^\/api\/progress$/, () => json(200, { completed: [...progress.values()] } satisfies Progress)],
    [
      'PUT',
      /^\/api\/progress\/([a-z0-9-]+)$/,
      async ([topicId = ''], request) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return problem(400, 'Send a JSON body: { "trackId": "…", "score": 0.8 }');
        }
        const update = ProgressUpdate.safeParse(body);
        if (!update.success) {
          return problem(400, update.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; '));
        }
        const track = content().tracks.find((t) => t.id === update.data.trackId);
        if (!track?.topics.some((t) => t.id === topicId)) {
          return problem(404, `No topic "${topicId}" in track "${update.data.trackId}"`);
        }
        const entry: TopicProgress = { topicId, ...update.data, completedAt: now().toISOString() };
        progress.delete(topicId); // finishing a topic again moves it to the end
        progress.set(topicId, entry);
        return json(200, entry);
      },
    ],
  ];

  return {
    async handle(request) {
      if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
      const { pathname } = new URL(request.url);
      const matches = routes.flatMap(([method, pattern, answer]) => {
        const match = pattern.exec(pathname);
        return match ? [{ method, params: match.slice(1), answer }] : [];
      });
      if (matches.length === 0) return problem(404, `No API at ${pathname}`);
      const route = matches.find((m) => m.method === request.method);
      if (!route) {
        const allow = matches.map((m) => m.method).join(', ');
        return problem(405, `${request.method} is not allowed here; use ${allow}`, { allow });
      }
      try {
        return await route.answer(route.params, request);
      } catch (error) {
        // Content that breaks the rules: say so, as the real API would log it and answer 500.
        return problem(500, error instanceof Error ? error.message : String(error));
      }
    },
    reset() {
      progress.clear();
    },
  };
}
