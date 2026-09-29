## A request and its answer

Every API call is one HTTP **request** and one **response**, both plain text with the same shape: a first line, headers, a blank line, then an optional body. You rarely see the text, because `fetch` and Express build it for you, but knowing its parts is what lets you debug an API:

```http
POST /api/tasks HTTP/1.1
Host: example.com
Content-Type: application/json

{"title":"Write the report"}
```

```http
HTTP/1.1 201 Created
Content-Type: application/json; charset=utf-8
Location: /api/tasks/42

{"id":42,"title":"Write the report","done":false}
```

The request names a **method** and a **path**; the response answers with a **status code**. Headers carry everything else: the body's format, caching rules, cookies, who is asking.

## Methods say what the request does

- **GET** reads. It must not change anything, so browsers, caches and crawlers can repeat it freely.
- **POST** creates, or runs an action that fits no other method. Sending it twice can create two things.
- **PUT** replaces a resource with the body, or creates it at that address.
- **PATCH** changes part of a resource.
- **DELETE** removes it.

Two words interviewers love: a method is **safe** when it changes nothing (GET, HEAD), and **idempotent** when sending it twice leaves the server in the same state as sending it once (GET, PUT, DELETE, but not POST). Idempotent requests can be retried after a network failure without harm, which is why `PUT /progress/event-loop` is a better design for "mark this done" than `POST /progress`.

## Status codes say how it went

The first digit is the family: **2xx** success, **3xx** go elsewhere, **4xx** the client's mistake, **5xx** the server's. The ones you will use every week:

- **200 OK**, **201 Created** (with a `Location` header pointing at the new thing), **204 No Content** (success, nothing to send back).
- **400 Bad Request** (the body or query is wrong), **401 Unauthorized** (we don't know who you are: sign in), **403 Forbidden** (we know who you are, and the answer is no), **404 Not Found**, **405 Method Not Allowed** (with an `Allow` header), **409 Conflict** (for example, that email is taken), **415 Unsupported Media Type**, **422 Unprocessable Content**, **429 Too Many Requests**.
- **500 Internal Server Error** (a bug) and **503 Service Unavailable** (down or overloaded; try later).

Clients branch on the status, so pick it carefully. An API that answers `200` with `{ "error": "not found" }` forces every client to read the body to learn that something failed.

## Headers and JSON

- `Content-Type` says what the body is: `application/json` for JSON. A server should check it before parsing, and set it on its answers.
- `Accept` says what the client wants back.
- `Authorization` and `Cookie` say who is asking; `Set-Cookie` gives the browser a cookie.
- `Cache-Control` says who may keep a copy, and for how long.

JSON bodies are UTF-8 text. With `fetch`, send one with `JSON.stringify` and the header, and remember that `fetch` only rejects on network failure: a 404 or 500 still resolves, so check `response.ok`, as in [the async code lesson](lesson:async-code).

## Designing REST URLs

REST is a style, not a standard: URLs name **resources** (nouns), and methods say what to do with them.

- Collections are plural: `GET /api/tasks` lists, `POST /api/tasks` creates.
- One item has its id: `GET`, `PATCH` or `DELETE /api/tasks/42`.
- Nesting shows ownership, one level deep: `GET /api/projects/7/tasks`.
- Filtering, sorting and paging go in the query string: `GET /api/tasks?done=false&page=2`.
- Errors have one shape everywhere, such as `{ "error": "No task 42" }`, so clients handle them once.

## Mistakes that cost time

- **Verbs in URLs** such as `/api/getTasks` or `/api/deleteTask?id=42`: the method already says it.
- **GET requests that change data,** which a prefetching browser or a crawler will happily trigger.
- **Returning 200 for every answer,** or 500 for the client's mistakes.
- **Mixing up 401 and 403:** 401 means "sign in", 403 means "signing in won't help".
- **Forgetting that `fetch` doesn't throw on 4xx and 5xx.**

## Say it in an interview

“HTTP is a request and a response: a method, a path, headers and a body going one way, a status code, headers and a body coming back. In a REST API, URLs name resources and methods say what to do: GET reads and is safe, PUT and DELETE are idempotent so they can be retried, POST creates. The status code tells the client how it went without reading the body: 201 with a Location for something new, 400 for bad input, 401 when I don't know who you are, 403 when I do and the answer is no, 404, 409 for a conflict, and 5xx only for the server's own failures.”
