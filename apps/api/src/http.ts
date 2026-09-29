// Errors and checks every route shares. Every error answer is JSON in the ApiError shape.
import type { ApiError } from '@lp/contracts';
import type { ErrorRequestHandler, Request, RequestHandler, Response } from 'express';
import type { z } from 'zod';

/** An answer that is the client's to fix (4xx), with the message it shows. */
export class HttpError extends Error {
  readonly status: number;
  readonly fields: Record<string, string> | undefined;
  readonly headers: Record<string, string>;

  constructor(
    status: number,
    message: string,
    options: { fields?: Record<string, string>; headers?: Record<string, string> } = {},
  ) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.fields = options.fields;
    this.headers = options.headers ?? {};
  }
}

/** Checks a body against its schema; a failure is a 400 that names each field's first problem. */
export function parseBody<S extends z.ZodType>(schema: S, body: unknown): z.infer<S> {
  const result = schema.safeParse(body ?? {});
  if (result.success) return result.data;
  const fields: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || 'body';
    fields[key] ??= issue.message;
  }
  throw new HttpError(400, 'Check the highlighted fields and try again', { fields });
}

/** A path parameter. (The paths come from @lp/contracts, so Express cannot type them from a literal.) */
export function param(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== 'string') throw new Error(`The route has no :${name} parameter`);
  return value;
}

export function sendError(res: Response, status: number, body: ApiError, headers: Record<string, string> = {}) {
  res.status(status).set(headers).json(body);
}

/** For a path that exists but not with this method. */
export const methodNotAllowed =
  (...allowed: string[]): RequestHandler =>
  (req) => {
    throw new HttpError(405, `${req.method} is not allowed here; use ${allowed.join(', ')}`, {
      headers: { allow: allowed.join(', ') },
    });
  };

/**
 * Writes must be JSON. A cross-site form can only send form encodings, so this also stops forms on other sites
 * from acting as a signed-in learner (with SameSite=Lax cookies, a second layer against CSRF).
 */
export const requireJsonWrites: RequestHandler = (req, _res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || req.is('application/json')) return next();
  throw new HttpError(415, 'Send a JSON body, with Content-Type: application/json');
};

/** The last handler: turns anything thrown into an ApiError answer, and logs what was not the client's fault. */
export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (error instanceof HttpError) {
    const body: ApiError = { error: error.message, ...(error.fields ? { fields: error.fields } : {}) };
    return sendError(res, error.status, body, error.headers);
  }
  // body-parser's errors (bad JSON, too large) carry a 4xx status and a type.
  const status = typeof error?.status === 'number' ? error.status : 500;
  if (status >= 400 && status < 500) {
    const message =
      error.type === 'entity.parse.failed'
        ? 'The body is not valid JSON'
        : error.type === 'entity.too.large'
          ? 'The body is too large'
          : String(error.message);
    return sendError(res, status, { error: message });
  }
  console.error(`${req.method} ${req.originalUrl} failed:`, error);
  sendError(res, 500, { error: 'Something went wrong on our side. Try again in a moment.' });
};
