## Why code waits without freezing

Your JavaScript runs on one thread. A network request can take a second; if the code stood still until the answer arrived, the page would freeze. So slow work is started, your code carries on, and you say what should happen when the result is ready. A **promise** is the object that stands for that future result.

## Promises

A promise is *pending* at first, then settles once: *fulfilled* with a value, or *rejected* with an error. After that it never changes.

```js
fetch('/api/user')
  .then((response) => response.json())
  .then((user) => console.log(user.name))
  .catch((error) => console.error('Could not load the user', error))
  .finally(() => spinner.remove());
```

Each `.then` returns a new promise, which is what lets the steps chain. One `.catch` at the end handles a rejection from any step above it, and `.finally` runs either way, which suits hiding a spinner.

You rarely build a promise yourself, because APIs like `fetch` hand you one. The main exception is wrapping something that uses callbacks, such as a timer:

```js
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
await wait(500); // carries on after half a second
```

## async and await

An `async` function can pause at each `await` until a promise settles, so asynchronous code reads like ordinary code from top to bottom:

```js
async function loadUser(id) {
  const response = await fetch(`/api/users/${id}`);
  const user = await response.json();
  return user;
}
```

Three facts do most of the work:

- **An async function always returns a promise.** `return user` fulfils it and `throw` rejects it, so callers write `await loadUser(1)` or `loadUser(1).then(…)`.
- **`await` turns a rejection into a thrown error**, so an ordinary `try` and `catch` handles it.
- **The function runs straight away until its first `await`.** There it pauses and the code that called it carries on; the rest of the function runs later. [The event loop lesson](lesson:event-loop) explains exactly when.

## fetch, properly

`fetch(url, options)` resolves as soon as the response's status and headers arrive. Two things catch everyone out:

1. **It doesn't reject for HTTP errors.** A 404 or a 500 is still a response. `fetch` rejects only when no response arrives at all: the network is down, the request was blocked, or it was aborted. Check `response.ok`, which is true for statuses 200 to 299.
2. **Reading the body is a second wait.** `response.json()` reads the body and parses it, and returns another promise.

```js
async function getJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${url}`);
  }
  return response.json();
}
```

To send JSON, set the method, say what the body is, and turn the data into a string:

```js
await fetch('/api/todos', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ title: 'Learn fetch' }),
});
```

## Handle every outcome

A screen that loads data has three states, and the user should see each one: loading, failed, and done.

```js
async function showProfile(id) {
  status.textContent = 'Loading…';
  try {
    const user = await getJson(`/api/users/${id}`);
    status.textContent = `Hello, ${user.name}`;
  } catch (error) {
    status.textContent = 'Could not load your profile. Try again.';
    console.error(error);
  }
}
```

The `await` inside the `try` matters. Without it, the `try` block finishes before the promise rejects, the `catch` never runs, and the browser reports an unhandled rejection. In Node.js, an unhandled rejection stops the whole process.

## In parallel, not in a queue

Each `await` waits before the next line starts. When requests don't depend on each other, start them all and then wait for them together:

```js
// About 3 seconds: each request starts when the one before it has finished.
const user = await getJson('/api/user');
const posts = await getJson('/api/posts');
const tags = await getJson('/api/tags');
```

```js
// About 1 second: all three requests start at once.
const [user, posts, tags] = await Promise.all([
  getJson('/api/user'),
  getJson('/api/posts'),
  getJson('/api/tags'),
]);
```

`Promise.all` rejects as soon as any one of them rejects. When you want every outcome, failures included, use `Promise.allSettled`. When one request needs another's result, for example the user's team id before you can load the team, awaiting them one after another is correct.

To cancel a request, because the user typed a new search or left the page, pass `{ signal: controller.signal }` from an `AbortController` to `fetch` and call `controller.abort()`. The `fetch` then rejects with an error named `AbortError`, which you can usually ignore.

## Mistakes that cost time

- **Forgetting `await`.** You get a promise where you expected data, and `user.name` is `undefined`.
- **Not checking `response.ok`**, then trying to parse an HTML error page as JSON.
- **`await` in a loop for independent requests.** Start them all with `Promise.all(ids.map(load))`.
- **`forEach` with an async callback.** `forEach` doesn't wait for promises. Use `for...of` with `await` to go one at a time, or `Promise.all` to go in parallel.
- **An empty `catch`.** It hides the bug and leaves the user staring at a spinner. Show a message and log the error.

## Say it in an interview

“A promise stands for a result that isn't ready yet: it's pending, then fulfilled or rejected. `async` and `await` are syntax on top of promises. An async function always returns a promise, and `await` pauses the function until a promise settles, turning a rejection into an error I can catch with `try` and `catch`. With `fetch` I always check `response.ok`, because HTTP errors don't reject, and I use `Promise.all` to run independent requests in parallel.”
