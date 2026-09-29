// A small REST API for notes, with node:http and nothing else.
// Use it as: http.createServer(createNotesHandler()).listen(3000)

/** Sends `body` as JSON with the given status. Use it for every answer that has a body. */
function sendJson(res, status, body, headers = {}) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(body));
}

/** The request body as text. */
async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

export function createNotesHandler() {
  const notes = new Map(); // id → { id, text }
  let nextId = 1;

  async function create(req, res) {
    if (!req.headers['content-type']?.startsWith('application/json')) {
      return sendJson(res, 415, { error: 'Send JSON, with Content-Type: application/json' });
    }
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'The body is not valid JSON' });
    }
    const text = typeof body?.text === 'string' ? body.text.trim() : '';
    if (!text) return sendJson(res, 400, { error: 'Send the note as { "text": "…" }' });
    const note = { id: nextId++, text };
    notes.set(note.id, note);
    sendJson(res, 201, note, { location: `/api/notes/${note.id}` });
  }

  return async (req, res) => {
    const { pathname } = new URL(req.url, 'http://localhost');

    if (pathname === '/api/notes') {
      if (req.method === 'GET') return sendJson(res, 200, [...notes.values()]);
      if (req.method === 'POST') return create(req, res);
      return sendJson(res, 405, { error: `${req.method} is not allowed here` }, { allow: 'GET, POST' });
    }

    const match = /^\/api\/notes\/(\d+)$/.exec(pathname);
    if (match) {
      const id = Number(match[1]);
      const note = notes.get(id);
      if (req.method === 'GET') return note ? sendJson(res, 200, note) : sendJson(res, 404, { error: `No note ${id}` });
      if (req.method === 'DELETE') {
        if (!note) return sendJson(res, 404, { error: `No note ${id}` });
        notes.delete(id);
        res.writeHead(204);
        return res.end();
      }
      return sendJson(res, 405, { error: `${req.method} is not allowed here` }, { allow: 'GET, DELETE' });
    }

    sendJson(res, 404, { error: `No route for ${pathname}` });
  };
}
