// Serves the mock API from Vite's dev and preview servers, under /api. In development it waits a little before
// answering, so loading states show up (MOCK_API_DELAY=0 turns that off), and reloads the content after an edit.
import type { IncomingMessage } from 'node:http';
import { DATA_DIR, loadContent } from '@lp/content';
import type { Content } from '@lp/contracts';
import type { Connect, Plugin } from 'vite';
import { createMockApi, type MockApi } from './handler.ts';

/** The request body as text: the API only takes JSON. */
async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

/** Connect middleware that answers /api/… from `api`, and passes every other request on. */
export function mockApiMiddleware(api: MockApi): Connect.NextHandleFunction {
  return (req, res, next) => {
    const url = req.originalUrl ?? req.url ?? '/';
    if (!url.startsWith('/api/')) {
      next();
      return;
    }
    void (async () => {
      const method = req.method ?? 'GET';
      const headers = new Headers();
      if (req.headers['content-type']) headers.set('content-type', req.headers['content-type']);
      const body = method === 'GET' || method === 'HEAD' ? undefined : await readBody(req);
      const response = await api.handle(new Request(new URL(url, 'http://localhost'), { method, headers, body }));
      res.statusCode = response.status;
      response.headers.forEach((value, key) => {
        res.setHeader(key, value);
      });
      res.end(Buffer.from(await response.arrayBuffer()));
    })().catch(next);
  };
}

export function mockApi({ devDelayMs = 300 }: { devDelayMs?: number } = {}): Plugin {
  const delay = (fallback: number) => Number(process.env.MOCK_API_DELAY ?? fallback);
  let content: Content | undefined;
  const current = () => {
    content ??= loadContent();
    return content;
  };
  return {
    name: 'lp-mock-api',
    configureServer(server) {
      server.watcher.add(DATA_DIR);
      server.watcher.on('all', (_event, file) => {
        if (file.startsWith(DATA_DIR)) content = undefined;
      });
      server.middlewares.use(mockApiMiddleware(createMockApi({ content: current, delayMs: delay(devDelayMs) })));
    },
    configurePreviewServer(server) {
      server.middlewares.use(mockApiMiddleware(createMockApi({ content: current, delayMs: delay(0) })));
    },
  };
}
