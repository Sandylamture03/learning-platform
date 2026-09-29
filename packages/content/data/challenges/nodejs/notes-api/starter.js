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
  const nextId = 1;

  return async (req, res) => {
    const { pathname } = new URL(req.url, 'http://localhost');
    // TODO: GET and POST /api/notes; GET and DELETE /api/notes/:id; 405 with Allow; 404 for the rest.
    sendJson(res, 501, { error: 'Not written yet' });
  };
}
