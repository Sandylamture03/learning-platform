## An app is a list of middleware

Express turns Node.js's bare `http` module into something pleasant to build an API with. Its one big idea: an app is an ordered list of **middleware**, functions that receive the request (`req`), the response (`res`) and `next`. Each one either answers, or calls `next()` to hand the request to the next one in the list.

```js
import express from 'express';

const app = express();
app.use(express.json()); // parse JSON bodies into req.body

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.listen(3000);
```

A **route** such as `app.get(path, handler)` is middleware that only runs for one method and path. `express.json()` is middleware too: it reads the body and puts the parsed object on `req.body`, then calls `next()`.

## Routes and routers

- **Parameters** come from the path: `app.get('/api/tasks/:id', …)` gives `req.params.id`, always as a string.
- **The query string** arrives in `req.query`: `/api/tasks?done=false` gives `{ done: 'false' }`, also strings.
- **Answering:** `res.status(201).json(task)` sets the status and sends JSON; `res.status(204).end()` sends nothing; `res.set(name, value)` sets a header.
- **Routers** group routes: `const tasks = express.Router()`, then `app.use('/api/tasks', tasks)` mounts them all under one prefix, so a big app splits into one file per resource.

Answer exactly once. Calling `res.json()` twice, or forgetting to answer at all, are the two classic Express bugs: the first throws "Cannot set headers after they are sent to the client", the second leaves the client waiting until it times out.

## Middleware: next, and the order it runs in

Middleware runs in the order you register it, which is why `express.json()` comes before the routes that read `req.body`. Write your own for anything that applies to many routes:

```js
function requestTimer(req, res, next) {
  const started = performance.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Math.round(performance.now() - started)}ms`);
  });
  next();
}

app.use(requestTimer);
```

Middleware can also end the request early: an authentication check answers 401 and never calls `next()`, so the route behind it never runs. You can pass middleware to one route only: `app.delete('/api/tasks/:id', requireAdmin, deleteTask)`.

## Errors: one handler at the end

An **error-handling middleware** has four parameters, `(err, req, res, next)`, and goes after every route. Anything thrown in a route ends up there, so you write error responses once instead of in every handler:

```js
app.use((err, req, res, next) => {
  const status = err.status ?? 500;
  if (status === 500) console.error(err);
  res.status(status).json({ error: status === 500 ? 'Something went wrong' : err.message });
});
```

Never send a 500's real message to the client: stack traces and SQL errors tell attackers how your app works. Log it, and answer with something generic.

## What changed in Express 5

Express 5 is the current version, and most tutorials still show Express 4. The changes that matter day to day:

- **Async errors are caught.** In Express 4, an `async` handler that threw left the request hanging unless you wrapped it in `try`/`catch` and called `next(error)`. In Express 5, a rejected promise goes to the error handler by itself.
- **Path patterns are stricter.** A wildcard needs a name, `/files/*path`, and optional parts use braces, `/tasks{/:id}`.
- **`req.body` is `undefined`** when no body parser ran, instead of `{}`.
- **Removed shortcuts** such as `res.send(status)` with a number, `app.del()` and `req.param()`.

## Mistakes that cost time

- **Registering `express.json()` after the routes,** so `req.body` is undefined.
- **Putting the error handler first,** or giving it three parameters: Express only treats four-parameter functions as error handlers.
- **Answering twice,** or not at all, in a branch you forgot.
- **Trusting `req.params` and `req.query` types:** they are strings, and whatever the client sent. Validate them, as in [the input validation lesson](lesson:input-validation-zod).

## Say it in an interview

“An Express app is an ordered chain of middleware: each function gets the request, the response and next, and either answers or passes the request on. Routes are middleware bound to a method and path, routers group them by resource, and cross-cutting things like body parsing, logging and auth checks are middleware registered before the routes. Errors go to one four-argument error handler at the end, which decides the status and never leaks internals on a 500. In Express 5 that includes errors thrown in async handlers, which Express 4 used to lose.”
