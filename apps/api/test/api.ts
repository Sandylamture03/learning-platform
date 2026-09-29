// The app on a real port, and a client that keeps cookies the way a browser does.
import type { AddressInfo } from 'node:net';
import { loadContent } from '@lp/content';
import { type AppOptions, createApp } from '../src/app.ts';

export const content = loadContent();

// biome-ignore lint/suspicious/noExplicitAny: a test reads whatever JSON came back and asserts on it.
type Json = any;

export interface Answer<T = unknown> {
  status: number;
  headers: Headers;
  body: T;
}

/** A browser stand-in: sends the cookies it was given back, and JSON bodies with their Content-Type. */
export class Browser {
  readonly cookies = new Map<string, string>();
  readonly base: string;

  constructor(base: string) {
    this.base = base;
  }

  async send<T = Json>(
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ): Promise<Answer<T>> {
    const cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    const response = await fetch(this.base + path, {
      method,
      redirect: 'manual',
      headers: {
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(cookie ? { cookie } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
    for (const line of response.headers.getSetCookie()) {
      const [pair = '', ...attributes] = line.split(';');
      const [name = '', value = ''] = pair.split('=');
      const expired = attributes.some(
        (a) => /^\s*expires=/i.test(a) && Date.parse(a.split('=')[1] ?? '') <= Date.now(),
      );
      if (expired || value === '') this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    const text = await response.text();
    const json = response.headers.get('content-type')?.includes('json');
    return { status: response.status, headers: response.headers, body: (json && text ? JSON.parse(text) : text) as T };
  }

  get = <T = Json>(path: string) => this.send<T>('GET', path);
  post = <T = Json>(path: string, body: unknown = {}) => this.send<T>('POST', path, body);
  put = <T = Json>(path: string, body: unknown) => this.send<T>('PUT', path, body);
}

export async function startApi(options: Omit<AppOptions, 'content'> & Partial<Pick<AppOptions, 'content'>>) {
  const app = createApp({ content, ...options });
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    base,
    browser: () => new Browser(base),
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

let count = 0;
/** A new learner's sign-up details. */
export const learner = (name = 'Asha Rao') => ({
  name,
  email: `learner${++count}.${Date.now()}@example.com`,
  password: 'correct horse battery staple',
});
