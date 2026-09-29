# Learning Platform

Learn the 20% of HTML5, CSS3, JavaScript, TypeScript, React and Node.js that real jobs use.

This repo holds the first five phases of the Learning Platform build plan: **Phase 0** (monorepo, content schema, your 80/20 guides imported as track outlines, CI), **Phase 1** (the public site in semantic HTML5 and CSS3), **Phase 2** (the first JavaScript: a resource finder and a quiz, written as plain custom elements, and the five JavaScript P0 lessons), **Phase 3** (the React learning app, which hosts those widgets unchanged, and the core React and TypeScript lessons) and **Phase 4** (the Node.js API on PostgreSQL, with accounts and saved progress, and the core Node.js lessons).

## Quick start

You need **Node.js 24 LTS** (see `.nvmrc`), **pnpm 11**, and **Docker** (Docker Desktop on Windows and macOS) for the database.

```sh
corepack enable        # once; lets Node.js install the pnpm version pinned in package.json
pnpm install
pnpm dev               # builds the site and serves it at http://localhost:4321

pnpm db:up             # starts PostgreSQL in Docker (compose.yaml)
pnpm dev:app           # the API on :3000 and the learning app at http://localhost:5173
```

`pnpm dev:app` migrates the database before the API starts. No Docker? `pnpm dev:app:mock` runs the app against an in-memory mock of the API instead: accounts and progress work until you stop it. Any PostgreSQL 16 or newer works too: point `DATABASE_URL` at it (and `TEST_DATABASE_URL` for the tests).

On Windows, if `corepack enable` says "permission denied", run it once from a terminal opened as administrator, or use `npm install --global pnpm@11` instead.

To look at the site without installing anything, open `apps/site/dist/index.html` in a browser: the build uses relative links, so it works straight from disk. The sign-up form and the widgets need `pnpm dev`; opened from disk, the resources and quiz pages show their no-JavaScript version instead.

## What's where

| Path | What it is |
| --- | --- |
| `apps/site` | The public site: a small TypeScript generator that turns the content into HTML pages, one CSS file and the JSON the widgets fetch. JavaScript only on the pages with a widget. |
| `apps/shell` | The React 19 + TypeScript learning app: your learning path, each track, each lesson with its quiz, the resources, and signing up and in, on React Router and TanStack Query. The Phase 2 widgets run inside it unchanged, through `ModuleOutlet`. `mock-api/` is an in-memory stand-in for the API, for unit tests and `dev:app:mock`. |
| `apps/api` | The Node.js API: Express 5 on PostgreSQL. The content, accounts, each learner's progress and the waitlist, at the paths `@lp/contracts` names. SQL migrations in `migrations/`. |
| `packages/widgets` | The Phase 2 widgets: `<lp-resource-finder>` and `<lp-quiz>`, plain JavaScript custom elements with no build step, type-checked through `// @ts-check` and JSDoc. |
| `packages/content` | All content: 5 tracks (20 lessons written so far), 200 web resources, your 46-file library, 100 quiz questions and 20 coding challenges, as JSON, with lesson theory in Markdown and challenge code in JavaScript, JSX and TypeScript. Plus the loader, the views the site and the API both serve (`views.ts`), and the `check` command. |
| `packages/contracts` | Zod schemas shared by everything: tracks, topics (the five-part template), questions, challenges, the waitlist form, accounts, and the API's paths and shapes. |
| `packages/markdown` | The strict Markdown subset lessons are written in: a parser that turns theory into a small tree, which the site renders as HTML and the app as React elements. |
| `packages/styles` | The stylesheet the site and the app share: the cascade-layer order, reset, base, layout and components, built on the design tokens. |
| `packages/design-tokens` | Colours, type, spacing and shapes as CSS custom properties, light and dark. Contrast is tested. |
| `packages/platform-kit` | The contract between the shell and its UI modules (`mount`/`unmount`) and a typed event bus. |
| `packages/config` | Shared TypeScript presets: strict base, Node.js, browser. |
| `tools/check-boundaries.ts` | Import rules between packages. |

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Build the site, serve it on port 4321, rebuild when content or CSS changes |
| `pnpm dev:app` | Run the API (port 3000, restarting when its code changes) and the learning app (port 5173), which sends `/api` to it |
| `pnpm dev:app:mock` | Run the learning app against the in-memory mock instead: no database (it answers after 300 ms, so loading states show; `MOCK_API_DELAY=0` turns that off) |
| `pnpm dev:api` | Run only the API |
| `pnpm db:up` / `pnpm db:down` | Start / stop PostgreSQL in Docker. The data stays in a Docker volume between runs |
| `pnpm db:migrate` | Apply new migrations to `DATABASE_URL`, creating the database if it is missing |
| `pnpm build` | Build every app (`apps/site/dist`, `apps/shell/dist`) |
| `pnpm test` | Unit and build tests (Vitest) in every package, the API's against PostgreSQL (start it first with `pnpm db:up`), and every coding challenge's tests against its solution |
| `pnpm test:e2e` | Browser checks with Playwright, for the site and then the app against the real API and PostgreSQL: axe in light and dark, 320px layouts, keyboard, the form, the widgets with and without JavaScript, deep links, and a learner who signs up, passes a quiz and keeps it after a reload (run `pnpm --filter @lp/site exec playwright install chromium` once first, or set `PW_CHROMIUM_PATH` to an installed Chrome) |
| `pnpm typecheck` | TypeScript 7 in strict mode, every package, including the widgets' JavaScript (`checkJs`) |
| `pnpm lint` / `pnpm fix` | Biome: lint and format check / apply fixes |
| `pnpm check:content` | Validate every content file and cross-reference |
| `pnpm check:boundaries` | Check imports between packages |
| `pnpm validate:html` | html-validate on the built site |
| `pnpm verify` | Everything CI runs, in one go, except the browser checks (not `pnpm ci`: that is pnpm's own clean-install command). Needs PostgreSQL running |

Turborepo caches `build`, `test`, `typecheck` and `check`, so a second run only redoes what changed.

## Content

Content lives in `packages/content/data` and is the source of truth; the site is generated from it.

```text
data/
  tracks/<track-id>.json     modules (weeks), topic outlines, skip list, capstone
  resources.json             every web link, referenced by id
  library.json               the files in your study folders, with their verdicts
  questions/<track-id>.json  quiz and Interview Vault questions, one array per track
  challenges/<track-id>.json coding challenges, one array per track
  challenges/<track>/<id>/   each challenge's starter, solution and tests (.js, .jsx or .ts)
  theory/<track>/<topic>.md  theory for written topics
```

The tracks were imported once from your 80/20 guides: weeks became modules, "Done when" lists became each module's assessment, skip lists became "Not now", and weekly builds became Practice Lab briefs. The TypeScript track is assembled from the TypeScript weeks of the JavaScript, React, Node.js and Full-Stack guides. From now on, edit the JSON directly and run `pnpm check:content`.

A topic moves through three statuses, and the schema tightens at each step:

1. **outline**: title, priority, module and why it matters (what the import produced).
2. **draft**: the five-part template, in any state: header (summary, level, objectives), theory, code examples, resources, assessment.
3. **published**: exactly three objectives, two to four examples, three to five resources, four to six questions and a coding task.

`pnpm check:content` reports every problem at once, with the file and field, for example
`tracks/react.json topics[2].module: Unknown module "week-9" in track "react"`.

Every written topic (draft or published) gets a lesson page at `lessons/<topic-id>.html`, linked from its row in the track's topic table: the header, the objectives, the theory, the code examples, the resources (required ones under "Start here") and "Check yourself", with the quiz and the coding task. Twenty topics are published: the five JavaScript P0 topics; the core five of React (components and props, lists, state and events, effects, custom hooks) and of TypeScript (types and interfaces, unions, narrowing, generics, discriminated unions for UI state); and the five Node.js topics the API itself is built on (HTTP and REST, Express 5, validation with Zod, SQL and PostgreSQL, auth). The other topics stay outlines until their lessons are written. The app shows the same lessons, from the same content, through the API.

- **Theory is Markdown, in a strict subset:** `##` and `###` headings, paragraphs, one level of `-` or `1.` list, fenced code blocks, and inline `` `code` ``, `**strong**`, `*emphasis*` and links. Link to the web with `https://`, or to another written lesson with `lesson:<topic-id>`. Anything else (raw HTML, tables, images, nested lists, an unclosed backtick) fails the build with the file and line, and every piece of text is escaped. Each theory file so far ends with "Say it in an interview", a model answer to practise out loud.
- **Short text fields take inline Markdown:** objectives, example takeaways, resource notes, and challenge prompts and hints can use `` `code` ``, bold, emphasis and links. Summaries and `why` stay plain text, because they also go into meta descriptions and tables.
- **A coding challenge is three files:** a starter (what the learner starts from), a solution and tests, which import the solution: `.js` files, `.jsx` for a React component, `.ts` for TypeScript. A DOM or React challenge adds `// @vitest-environment happy-dom` and tests with Testing Library. `pnpm test` runs every challenge's tests against its solution, so a published challenge is known to be solvable. TypeScript challenges also check types, with `expectTypeOf` and `// @ts-expect-error` lines that `pnpm typecheck` verifies, so a solution whose types are too loose fails even when it runs. Node.js challenges run real servers on a random port (`node:http`, Express), and the SQL one runs its queries on PGlite, PostgreSQL compiled to WebAssembly, so it needs no database server. The lesson page shows the starter, the three hints and the solution behind disclosures, and lists the test names under "Done when it", so write each `it('…')` name to finish that sentence. A challenge lists its topics, and a topic may only use a challenge that lists it back.

Every topic with quiz questions gets a quiz page, linked from its row in the track's topic table. A question joins a quiz when its `usage` includes `"quiz"` and it is one the browser can mark (`mcq`, `multi_select` or `predict_output`). An outline topic takes all of its quiz questions and a pass mark of 80%; a written topic takes the questions in its assessment, with its own pass mark. Each published topic has five questions: `questions/javascript.json`, `questions/typescript.json`, `questions/react.json` and `questions/nodejs.json` hold 25 each.

The library lists files by name and never copies them: several are paid ebooks or belong to their publishers.

## Phase gates

Phase 0

- [x] A fresh clone installs with `pnpm install --frozen-lockfile` and passes `pnpm verify`
- [x] The validator rejects a malformed topic (`packages/content/test/load.test.ts`)
- [x] All five track outlines load (`pnpm check:content`)

Phase 1

- [x] 0 errors from the W3C Nu HTML checker (CI job `verify`)
- [x] Lighthouse accessibility 95+ (100 on every page checked)
- [x] No horizontal scroll at 320px, on every page (`pnpm test:e2e`)
- [x] Keyboard walkthrough: skip link first, visible focus ring on every stop (`pnpm test:e2e`)

Phase 2

- [x] Both widgets work on the static site, in light and dark, at 320px and from the keyboard, with no axe violations (`pnpm test:e2e`)
- [x] `checkJs` passes: the widgets are plain JavaScript that TypeScript checks against the shared contracts (`pnpm typecheck`)
- [x] Typing fast never shows results for an old query (`packages/widgets/test/resource-finder.test.ts`, and in Chrome with a slow network in `pnpm test:e2e`)
- [x] The JavaScript P0 lessons are published (closures, array methods, DOM events and delegation, async/await and `fetch`, the event loop): theory, three examples, three to five resources, a five-question quiz and a coding task each, all passing the published-topic schema (`pnpm check:content`) and the browser checks above (`pnpm test:e2e`)

Phase 3

- [x] Every page of the app loads straight from its URL, with its own title and no console errors, and moving between pages puts focus on the main content (`pnpm test:e2e`)
- [x] The Phase 2 widgets run unchanged inside the app through `ModuleOutlet`: mounted with the platform context, unmounted when the learner moves on, and mounted once under StrictMode (`apps/shell/test/module-outlet.test.tsx`, `pnpm test:e2e`)
- [x] Passing a quiz marks the lesson done on the lesson and on the learning path, through TanStack Query and the mock API, and the change shows before the API answers (`apps/shell/test/app.test.tsx`, `pnpm test:e2e`)
- [x] Every app page checked has no axe violations in light and dark, no horizontal scroll at 320px, and a visible focus ring at every keyboard stop (`pnpm test:e2e`)
- [x] The core React and TypeScript lessons are published, five each, with coding tasks that run in `pnpm test` (React components and hooks in happy-dom) and type-check in `pnpm typecheck` (`pnpm check:content`)

Phase 4

- [x] The API answers every path the app uses, with the same shapes as before: the content endpoints return exactly the views the site builds from (`apps/api/test/content.test.ts`)
- [x] A learner can sign up, sign in and out, and keeps their progress across a reload and a new sign-in, in the real app against the real API and PostgreSQL (`pnpm test:e2e`)
- [x] Passwords are stored only as scrypt hashes, session tokens only as SHA-256 hashes, and the session cookie is `HttpOnly`, `SameSite=Lax` and `Secure` in production (`apps/api/test/accounts.test.ts`)
- [x] Each learner sees only their own progress, and progress needs a signed-in learner (`apps/api/test/progress.test.ts`)
- [x] Failed sign-ins are rate-limited; a wrong password and an unknown email get the same answer; writes must be JSON; a 500 never leaks its cause (`apps/api/test/accounts.test.ts`, `content.test.ts`)
- [x] The site's waitlist form is stored, updating a repeat sign-up instead of duplicating it (`apps/api/test/waitlist.test.ts`)
- [x] Migrations apply once each, in a transaction, and create the database when it is missing (`apps/api/test/units.test.ts`, `pnpm db:migrate`)
- [x] The core Node.js lessons are published (HTTP and REST, Express 5, Zod, SQL and PostgreSQL, auth), with coding tasks that run real servers and real SQL in `pnpm test` (`pnpm check:content`)

## Conventions

- **Node.js runs TypeScript directly** by stripping types, so there is no build step for scripts and packages. Use only erasable syntax (no `enum`, `namespace` or constructor parameter properties); `tsc` does the type checking.
- **Packages are imported by name** (`@lp/contracts`), never by relative path, and every import is declared in `package.json`. `@lp/contracts` and `@lp/platform-kit` stay free of `node:` imports so the browser can use them.
- **One cascade-layer order** for the site: `reset, tokens, base, layout, components, utilities`. Colours come only from the design tokens.
- **Pages ship no JavaScript unless they hold a widget**, and then only that widget's module, from this origin (the dev server's policy is `script-src 'self'`, with nothing inline). Forms use native validation with `:user-invalid`; the FAQ uses `details` and `summary`.
- **The site's sign-up form posts to `/api/waitlist`.** The API checks it with the shared Zod schema, stores it and redirects to the thank-you page. The site's own dev server (`pnpm dev`) checks it the same way but stores nothing, so the site runs without a database; in production, a reverse proxy sends `/api` to the API.
- **Biome has two overrides, each for a reason.** In `.tsx` files, `noRedundantRoles` is off because lists styled without bullets keep `role="list"`: Safari drops the list role from them otherwise. In challenge starters, `noUnusedFunctionParameters`, `noUnusedVariables` and `noUnusedImports` are off because a starter names the parameters, helpers and imports the learner will use. (Keep `biome.json` free of comments: Biome reads it as JSON, and a comment makes the file invalid, and `pnpm fix` then reformats the whole repo with Biome's defaults.)

### The API

- **The contracts are the API.** `@lp/contracts` names every path (`API`) and body (`SignUp`, `SignIn`, `ProgressUpdate`), and the API, the mock and the app all use them, so a changed shape fails the type check everywhere at once. Errors are always `{ "error": "…" }`, plus `"fields"` naming each field's problem when a body fails its schema.
- **Built for tests:** `createApp({ db, content, … })` makes the Express app without a port or a real database, and `src/server.ts` wires it to both. Each API test file makes its own schema in the test database and migrates it, so files run in parallel and never share rows.
- **Settings come from environment variables** (`src/config.ts`), checked with Zod at startup: `DATABASE_URL` (required in production), `PORT` (3000), `SESSION_DAYS` (30), `AUTH_ATTEMPTS` (20 failed sign-ins, and sign-ups, per address per 15 minutes), `TRUST_PROXY` (how many proxies sit in front, so rate limits see the learner's address) and `NODE_ENV`.
- **Passwords** are hashed with scrypt (N = 2^15, r = 8, p = 3, one of OWASP's settings) and a random salt, after Unicode normalisation, and checked in constant time. An unknown email is checked against a dummy hash, so it takes as long to refuse as a wrong password.
- **Sessions** are 256-bit random tokens in an `lp_session` cookie (`HttpOnly`, `SameSite=Lax`, `Secure` in production). The database keeps only each token's SHA-256, so a leaked table signs nobody in, and signing out deletes the row, so a copied cookie stops working.
- **Writes must be JSON.** A form on another site can only send form encodings, so this, with `SameSite=Lax`, keeps other sites from acting for a signed-in learner. The waitlist is the one form endpoint, and it changes no account.
- **Migrations** are plain SQL files, `migrations/NNN_name.sql`, applied in order, each once and in its own transaction, under an advisory lock so two servers never migrate at once. Never edit one that has run anywhere; add the next number.

### The learning app

- **The app talks to the API on its own origin.** Vite sends `/api` to the API (`API_URL`, by default port 3000) in `dev` and `preview`, so the session cookie needs no CORS. The mock in `apps/shell/mock-api` answers the same paths from memory, with the same accounts and errors, for unit tests and `pnpm dev:app:mock`; it is a fetch-style handler, `Request` in and `Response` out.
- **Signing in:** `/sign-in` and `/sign-up` show the API's field messages beside each field, and return to the page the learner came from (`?next=`, which only accepts paths inside the app, so it can't send anyone to another site). Progress shows only for a signed-in learner; a quiz passed while signed out is kept and saved as soon as they sign up or in.
- **Server state goes through TanStack Query.** Every page reads its data with a query from `src/api.ts`, and every query key starts with the resource it holds (`[tracks]`, `[lessons, topicId]`, `[me]`, `[progress]`). Signing in, up or out sets `[me]` from the answer and drops `[progress]`, so no learner ever sees another's. Requests are retried on network and server errors, never on an answer such as 404 that will not change. Marking a lesson done updates the progress at once, rolls back if the API refuses, and refetches either way; the lesson then says the result was not saved, and offers to send it again.
- **Widgets mount through `ModuleOutlet`,** which hands a `UiModule` an element React never touches, plus one platform context made for the life of the app. The widget gets its data URL from `data-src` (`/api/quizzes/<topic-id>` in the app), and a passed quiz reports `topic.completed.v1` on the event bus, which the shell records as progress.
- **Routes are React Router's data mode:** `/`, `/tracks/:trackId`, `/tracks/:trackId/:topicId`, `/resources`, `/sign-in` and `/sign-up`, with one router made outside React. A lesson opened under the wrong track moves to its own, and anything unknown gets a page that says so and links back.
- **Lesson links stay inside the app.** Theory is parsed by `@lp/markdown` and rendered as React elements, so a `lesson:<topic-id>` link becomes a router link to that lesson, in whichever track it lives.

### Widgets

The widgets follow section 2.3 of the architecture doc, so the Phase 3 shell can host them unchanged:

- **Plain JavaScript, no build step.** The site copies `packages/widgets/src` as it is. Each file starts with `// @ts-check` and takes its types from `@lp/contracts` and `@lp/platform-kit` through JSDoc `@import` comments; `tsc` checks them with `checkJs`.
- **One custom element per widget, plus a module.** `<lp-resource-finder src="…">` and `<lp-quiz src="…">` work straight in HTML. Each file's default export is a `UiModule`: `mount(el, ctx)` reads the data URL from `el.dataset.src`, and `unmount(el)` empties `el`.
- **The page's HTML is the fallback.** The site renders the full resource list, or every question with its answer in a `details`, inside the element. The widget's shadow root covers it once the script runs, and shows it again through a `slot` if the data can't load.
- **Text goes in as text.** Widgets build their DOM with `h()` from `dom.js`, which turns every string into a text node; there is no `innerHTML` anywhere, and a build test checks the shipped files for it.
- **Everything stops on disconnect.** Each connection gets an `AbortController`: its signal is on every listener and on the `fetch`, so removing the element removes the listeners and cancels the request.
- **The newest query wins.** The finder numbers its updates and drops any that finish after a newer one has started, so a slow response can never replace newer results.
- **Styles live in the shadow root** (`widgets.css`, linked from it). The page's CSS can't reach in, but the design tokens are custom properties and inherit through, so both themes work.
- **Quiz answers stay in the browser**, under `localStorage` key `lp.quiz.v1.<topic-id>`. A passed quiz emits `topic.completed.v1` on the shell's event bus, and the shell saves it to the learner's account.

## Next

Deployment (the API, the app and PostgreSQL behind one domain, with CI deploying `main`), then more lessons, track by track, starting with the rest of the Node.js P0 topics.
