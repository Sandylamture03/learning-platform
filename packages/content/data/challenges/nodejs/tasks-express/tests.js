import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from './solution.js';

/** An in-memory store that answers asynchronously, like a database. */
function memoryStore() {
  const tasks = [{ id: 1, title: 'Write the report', done: false }];
  return {
    list: async () => tasks,
    get: async (id) => tasks.find((t) => t.id === id) ?? null,
    create: async (title) => {
      const task = { id: tasks.length + 1, title, done: false };
      tasks.push(task);
      return task;
    },
  };
}

let server;
let base;
let store;

async function start(s) {
  store = s;
  server = createApp(store).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
}

beforeEach(() => start(memoryStore()));
afterEach(() => new Promise((resolve) => server.close(resolve)));

const post = (body) =>
  fetch(`${base}/api/tasks`, { method: 'POST', headers: { 'content-type': 'application/json' }, body });

describe('the tasks API', () => {
  it('lists the tasks, and reads one by id', async () => {
    expect(await (await fetch(`${base}/api/tasks`)).json()).toEqual([
      { id: 1, title: 'Write the report', done: false },
    ]);
    expect(await (await fetch(`${base}/api/tasks/1`)).json()).toEqual({
      id: 1,
      title: 'Write the report',
      done: false,
    });
  });

  it('creates a task with 201 and a Location header', async () => {
    const response = await post(JSON.stringify({ title: ' Ship it ' }));
    expect(response.status).toBe(201);
    expect(response.headers.get('location')).toBe('/api/tasks/2');
    expect(await response.json()).toEqual({ id: 2, title: 'Ship it', done: false });
  });

  it('answers 404 with a JSON error for a missing task, thrown from an async handler', async () => {
    const response = await fetch(`${base}/api/tasks/99`);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'No task 99' });
  });

  it('answers 400 for a missing title, and for JSON that does not parse', async () => {
    const missing = await post(JSON.stringify({}));
    expect(missing.status).toBe(400);
    expect(await missing.json()).toEqual({ error: 'Enter a title' });
    const broken = await post('{"title":');
    expect(broken.status).toBe(400);
    expect(await broken.json()).toEqual({ error: 'The body is not valid JSON' });
  });

  it('answers 404 with a JSON error for a route that does not exist', async () => {
    const response = await fetch(`${base}/api/projects`);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'No route for GET /api/projects' });
  });

  it('answers 500 without leaking the error when the store fails', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    await new Promise((resolve) => server.close(resolve));
    await start({
      ...memoryStore(),
      list: async () => Promise.reject(new Error('connect ECONNREFUSED 10.0.0.5:5432')),
    });
    const response = await fetch(`${base}/api/tasks`);
    expect(response.status).toBe(500);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({ error: 'Something went wrong' });
    expect(text).not.toContain('ECONNREFUSED');
    quiet.mockRestore();
  });

  it('gives every answer, errors too, its own x-request-id', async () => {
    const ids = await Promise.all(
      [`${base}/api/tasks`, `${base}/api/tasks/99`, `${base}/nowhere`].map(async (url) =>
        (await fetch(url)).headers.get('x-request-id'),
      ),
    );
    for (const id of ids) expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(new Set(ids).size).toBe(3);
  });
});
