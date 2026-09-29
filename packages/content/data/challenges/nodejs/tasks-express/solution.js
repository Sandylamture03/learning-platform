// A tasks API in Express 5. `store` is given to you, and every method is async, as a database would be:
//   store.list() → tasks, store.get(id) → a task or null, store.create(title) → the new task.
import { randomUUID } from 'node:crypto';
import express from 'express';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function createApp(store) {
  const app = express();

  // First, so even errors from the body parser carry an id.
  app.use((_req, res, next) => {
    res.set('x-request-id', randomUUID());
    next();
  });
  app.use(express.json());

  app.get('/api/tasks', async (_req, res) => {
    res.json(await store.list());
  });

  // No try/catch: Express 5 sends a rejected promise to the error handler.
  app.get('/api/tasks/:id', async (req, res) => {
    const task = await store.get(Number(req.params.id));
    if (!task) throw new HttpError(404, `No task ${req.params.id}`);
    res.json(task);
  });

  app.post('/api/tasks', async (req, res) => {
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    if (!title) throw new HttpError(400, 'Enter a title');
    const task = await store.create(title);
    res.status(201).location(`/api/tasks/${task.id}`).json(task);
  });

  app.use((req, res) => {
    res.status(404).json({ error: `No route for ${req.method} ${req.path}` });
  });

  // Four parameters make it the error handler, so the unused ones stay, named with an underscore.
  app.use((err, _req, res, _next) => {
    // body-parser marks broken JSON with status 400 and this type.
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'The body is not valid JSON' });
    const status = err instanceof HttpError ? err.status : 500;
    if (status === 500) console.error(err);
    res.status(status).json({ error: status === 500 ? 'Something went wrong' : err.message });
  });

  return app;
}
