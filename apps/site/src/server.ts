import { readFile, stat } from 'node:fs/promises';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { waitlistSignup } from '@lp/contracts';
import { ROUTES, WAITLIST_ENDPOINT } from './routes.ts';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  // Browsers refuse to run a module script served with any other type.
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

/**
 * Scripts, styles and data only from this origin, and nothing inline: the widgets are module files that fetch JSON
 * from here and link their stylesheet. connect-src also lets checkers such as Lighthouse fetch robots.txt.
 */
const SECURITY_HEADERS = {
  'Content-Security-Policy':
    "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

const MAX_BODY_BYTES = 10_000;

export interface SiteServerOptions {
  /** The built site (dist/). */
  root: string;
  /** Valid values for the form's track field. */
  trackIds: readonly [string, ...string[]];
  /** Called for each valid sign-up. The email and name are never logged. */
  onSignup?: (signup: { track: string; level: string; hoursPerWeek: number }) => void;
}

class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function readBody(req: IncomingMessage): Promise<string> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'Form too large');
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function send(
  res: ServerResponse,
  status: number,
  body: string | Buffer,
  type: string,
  headers: Record<string, string> = {},
) {
  // no-cache: always revalidate, so a rebuild shows up on refresh, while back/forward navigation stays instant.
  res.writeHead(status, { ...SECURITY_HEADERS, 'Content-Type': type, 'Cache-Control': 'no-cache', ...headers });
  res.end(body);
}

/**
 * Serves dist/ and stands in for the Phase 4 API's POST /api/waitlist: it checks the form with the
 * shared Zod contract, then redirects to the thank-you page (303 See Other, so a refresh never re-posts).
 */
export function createSiteServer({ root, trackIds, onSignup }: SiteServerOptions): Server {
  const rootDir = resolve(root);
  const Signup = waitlistSignup(trackIds);

  async function handle(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url ?? '/', 'http://localhost');

    if (url.pathname === WAITLIST_ENDPOINT) {
      if (req.method !== 'POST') throw new HttpError(405, 'Use POST');
      if (!req.headers['content-type']?.startsWith('application/x-www-form-urlencoded')) {
        throw new HttpError(415, 'Send the form as application/x-www-form-urlencoded');
      }
      const form = Object.fromEntries(new URLSearchParams(await readBody(req)));
      const parsed = Signup.safeParse(form);
      if (!parsed.success) {
        const problems = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
        return send(res, 400, `The form has problems:\n${problems}\n`, TYPES['.txt'] ?? 'text/plain');
      }
      const { track, level, hoursPerWeek } = parsed.data;
      onSignup?.({ track, level, hoursPerWeek });
      res.writeHead(303, { ...SECURITY_HEADERS, Location: `/${ROUTES.thanks}` });
      return res.end();
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Method not allowed');

    let pathname: string;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      throw new HttpError(400, 'Bad URL');
    }
    if (pathname.endsWith('/')) pathname += 'index.html';
    const file = resolve(rootDir, `.${pathname}`);
    const info = file.startsWith(rootDir + sep) ? await stat(file).catch(() => null) : null;
    if (info?.isDirectory()) {
      res.writeHead(301, { ...SECURITY_HEADERS, Location: `${url.pathname}/` });
      return res.end();
    }
    if (!info?.isFile()) {
      const page = await readFile(join(rootDir, ROUTES.notFound)).catch(() => Buffer.from('Not found'));
      return send(res, 404, page, TYPES['.html'] ?? 'text/html');
    }
    const body = await readFile(file);
    send(res, 200, req.method === 'HEAD' ? Buffer.alloc(0) : body, TYPES[extname(file)] ?? 'application/octet-stream');
  }

  return createServer((req, res) => {
    handle(req, res).catch((error: unknown) => {
      const status = error instanceof HttpError ? error.status : 500;
      if (status === 500) console.error(error);
      const message = error instanceof HttpError ? error.message : 'Something went wrong';
      if (!res.headersSent) send(res, status, `${message}\n`, TYPES['.txt'] ?? 'text/plain');
      else res.end();
    });
  });
}
