import { createServer } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createNotesHandler } from './solution.js';

let server;
let base;

beforeEach(async () => {
  server = createServer(createNotesHandler());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
afterEach(() => new Promise((resolve) => server.close(resolve)));

const post = (body, type = 'application/json') =>
  fetch(`${base}/api/notes`, { method: 'POST', headers: { 'content-type': type }, body });

describe('the notes API', () => {
  it('lists the notes as JSON, starting empty', async () => {
    const response = await fetch(`${base}/api/notes`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/^application\/json/);
    expect(await response.json()).toEqual([]);
  });

  it('creates a note with 201 Created and a Location header, and lists it', async () => {
    const response = await post(JSON.stringify({ text: '  Buy milk ' }));
    expect(response.status).toBe(201);
    expect(response.headers.get('location')).toBe('/api/notes/1');
    expect(await response.json()).toEqual({ id: 1, text: 'Buy milk' });
    expect(await (await fetch(`${base}/api/notes`)).json()).toEqual([{ id: 1, text: 'Buy milk' }]);
  });

  it('answers 400 for broken JSON or a missing text, and 415 for a body that is not JSON', async () => {
    const broken = await post('{"text":');
    expect(broken.status).toBe(400);
    expect((await broken.json()).error).toEqual(expect.any(String));
    expect((await post(JSON.stringify({ text: '   ' }))).status).toBe(400);
    expect((await post(JSON.stringify({ title: 'Buy milk' }))).status).toBe(400);
    expect((await post('text=Buy+milk', 'application/x-www-form-urlencoded')).status).toBe(415);
  });

  it('reads and deletes one note, and answers 404 for one that does not exist', async () => {
    await post(JSON.stringify({ text: 'Buy milk' }));
    expect(await (await fetch(`${base}/api/notes/1`)).json()).toEqual({ id: 1, text: 'Buy milk' });
    const deleted = await fetch(`${base}/api/notes/1`, { method: 'DELETE' });
    expect(deleted.status).toBe(204);
    expect(await deleted.text()).toBe('');
    expect((await fetch(`${base}/api/notes/1`)).status).toBe(404);
    expect((await fetch(`${base}/api/notes/1`, { method: 'DELETE' })).status).toBe(404);
  });

  it('answers 405 with an Allow header for a method a path does not take', async () => {
    const collection = await fetch(`${base}/api/notes`, { method: 'DELETE' });
    expect(collection.status).toBe(405);
    expect(collection.headers.get('allow')).toBe('GET, POST');
    const item = await fetch(`${base}/api/notes/1`, { method: 'PUT', body: '{}' });
    expect(item.status).toBe(405);
    expect(item.headers.get('allow')).toBe('GET, DELETE');
  });

  it('answers 404 with a JSON error for any other path', async () => {
    const response = await fetch(`${base}/api/notebooks`);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: expect.any(String) });
  });
});
