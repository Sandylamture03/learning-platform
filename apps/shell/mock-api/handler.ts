// The mock API: the same paths and shapes as the Node.js API (apps/api, @lp/contracts' API), answered from the
// content files, with accounts, sessions and progress kept in memory. It is a fetch-style handler, Request in and
// Response out, so the Vite dev and preview servers can serve it (plugin.ts) and tests can call it in place of
// fetch. It stands in for the real API in unit tests and in `pnpm dev:app:mock`, when there is no database.
import { randomUUID } from 'node:crypto';
import { DATA_DIR, lessonView, loadContent, quizData, resourceCatalogue, trackSummaries, trackView } from '@lp/content';
import {
  type ApiError,
  type Content,
  type Me,
  type Progress,
  ProgressUpdate,
  SignIn,
  SignUp,
  type TopicProgress,
  type User,
} from '@lp/contracts';
import type { z } from 'zod';

export interface MockApiOptions {
  /** Returns the content to serve; called on every request, so it can reload after an edit. */
  content?: () => Content;
  dataDir?: string;
  /** Waits this long before answering, so loading states show up in development. */
  delayMs?: number;
  /** The clock, for completedAt. */
  now?: () => Date;
  /**
   * Hears every cookie the API sets. A browser (and happy-dom) hides Set-Cookie from scripts, so tests that play
   * the browser's part keep their cookie jar with this.
   */
  onSetCookie?: (cookie: string) => void;
}

export interface MockApi {
  /**
   * Answers a request. `cookies` stands in for its Cookie header, for callers whose Request cannot carry one
   * (a browser, and happy-dom, forbid scripts from setting it).
   */
  handle(request: Request, cookies?: string): Promise<Response>;
  /** Forgets every account, session and bit of progress. */
  reset(): void;
}

/** The real API's cookie name, so the browser sees the same thing either way. */
export const SESSION_COOKIE = 'lp_session';

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
const problem = (status: number, error: string, headers?: Record<string, string>) =>
  json(status, { error } satisfies ApiError, headers);
const found = (body: unknown, what: string) => (body === undefined ? problem(404, what) : json(200, body));

/** Thrown inside a route to answer with an error, as the real API's HttpError does. */
class Refusal extends Error {
  readonly response: Response;

  constructor(response: Response) {
    super('refused');
    this.response = response;
  }
}

/** Writes must be JSON, as in the real API (where this also guards against cross-site forms). */
function requireJson(request: Request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) {
    throw new Refusal(problem(415, 'Send a JSON body, with Content-Type: application/json'));
  }
}

async function body<S extends z.ZodType>(request: Request, schema: S): Promise<z.infer<S>> {
  requireJson(request);
  let data: unknown;
  try {
    const text = await request.text();
    data = text === '' ? {} : JSON.parse(text);
  } catch {
    throw new Refusal(problem(400, 'The body is not valid JSON'));
  }
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  const fields: Record<string, string> = {};
  for (const issue of result.error.issues) fields[issue.path.join('.') || 'body'] ??= issue.message;
  throw new Refusal(json(400, { error: 'Check the highlighted fields and try again', fields } satisfies ApiError));
}

function readCookie(header: string | null | undefined, name: string): string | undefined {
  for (const part of header?.split(';') ?? []) {
    const eq = part.indexOf('=');
    if (eq !== -1 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return undefined;
}

const setCookie = (token: string) => `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax`;
const clearCookie = `${SESSION_COOKIE}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax`;

interface Call {
  request: Request;
  /** The Cookie header. */
  cookies: string | undefined;
  user: User | null;
}

type Route = [method: string, pattern: RegExp, answer: (params: string[], call: Call) => Promise<Response> | Response];

export function createMockApi({
  content = loadContent,
  dataDir = DATA_DIR,
  delayMs = 0,
  now = () => new Date(),
  onSetCookie,
}: MockApiOptions = {}): MockApi {
  // A test double, so passwords are kept as they are; the real API stores only scrypt hashes.
  const accounts = new Map<string, User & { password: string }>();
  const sessions = new Map<string, string>(); // token → user id
  const progress = new Map<string, Map<string, TopicProgress>>(); // user id → topic id → progress

  function signIn(user: User, status: number): Response {
    const token = randomUUID();
    sessions.set(token, user.id);
    onSetCookie?.(setCookie(token));
    return json(status, { user } satisfies Me, { 'set-cookie': setCookie(token) });
  }

  function signedIn(user: User | null, message: string): User {
    if (!user) throw new Refusal(problem(401, message));
    return user;
  }

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
    ['GET', /^\/api\/me$/, (_params, { user }) => json(200, { user } satisfies Me)],
    [
      'POST',
      /^\/api\/auth\/sign-up$/,
      async (_params, { request }) => {
        const { name, email, password } = await body(request, SignUp);
        if (accounts.has(email)) {
          return json(409, {
            error: 'There is already an account with this email',
            fields: { email: 'There is already an account with this email. Sign in instead.' },
          } satisfies ApiError);
        }
        const user = { id: randomUUID(), name, email };
        accounts.set(email, { ...user, password });
        return signIn(user, 201);
      },
    ],
    [
      'POST',
      /^\/api\/auth\/sign-in$/,
      async (_params, { request }) => {
        const { email, password } = await body(request, SignIn);
        const account = accounts.get(email);
        if (!account || account.password !== password)
          return problem(401, 'That email and password do not match an account');
        return signIn({ id: account.id, name: account.name, email: account.email }, 200);
      },
    ],
    [
      'POST',
      /^\/api\/auth\/sign-out$/,
      (_params, { request, cookies }) => {
        requireJson(request);
        const token = readCookie(cookies, SESSION_COOKIE);
        if (token) sessions.delete(token);
        onSetCookie?.(clearCookie);
        return new Response(null, { status: 204, headers: { 'set-cookie': clearCookie } });
      },
    ],
    [
      'GET',
      /^\/api\/progress$/,
      (_params, { user }) => {
        const { id } = signedIn(user, 'Sign in to see your progress');
        return json(200, { completed: [...(progress.get(id)?.values() ?? [])] } satisfies Progress);
      },
    ],
    [
      'PUT',
      /^\/api\/progress\/([a-z0-9-]+)$/,
      async ([topicId = ''], { request, user }) => {
        const { id } = signedIn(user, 'Sign in to save your progress');
        const update = await body(request, ProgressUpdate);
        const track = content().tracks.find((t) => t.id === update.trackId);
        if (!track?.topics.some((t) => t.id === topicId)) {
          return problem(404, `No topic "${topicId}" in track "${update.trackId}"`);
        }
        const entry: TopicProgress = { topicId, ...update, completedAt: now().toISOString() };
        const mine = progress.get(id) ?? new Map<string, TopicProgress>();
        mine.delete(topicId); // finishing a topic again moves it to the end
        mine.set(topicId, entry);
        progress.set(id, mine);
        return json(200, entry);
      },
    ],
  ];

  function currentUser(cookies: string | undefined): User | null {
    const token = readCookie(cookies, SESSION_COOKIE);
    const userId = token ? sessions.get(token) : undefined;
    const account = [...accounts.values()].find((a) => a.id === userId);
    return account ? { id: account.id, name: account.name, email: account.email } : null;
  }

  return {
    async handle(request, cookieHeader) {
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
        const cookies = cookieHeader ?? request.headers.get('cookie') ?? undefined;
        return await route.answer(route.params, { request, cookies, user: currentUser(cookies) });
      } catch (error) {
        if (error instanceof Refusal) return error.response;
        // Content that breaks the rules: say so, as the real API would log it and answer 500.
        return problem(500, error instanceof Error ? error.message : String(error));
      }
    },
    reset() {
      accounts.clear();
      sessions.clear();
      progress.clear();
    },
  };
}
