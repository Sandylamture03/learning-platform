// A tasks API in Express 5. `store` is given to you, and every method is async, as a database would be:
//   store.list() → tasks, store.get(id) → a task or null, store.create(title) → the new task.
import express from 'express';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function createApp(store) {
  const app = express();
  app.use(express.json());

  // TODO: an x-request-id header on every answer; the three routes; a JSON 404 for unknown routes;
  // one error handler at the end that answers 500s without leaking the error's message.

  return app;
}
