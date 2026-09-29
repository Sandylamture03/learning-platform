# Learning Platform

Learn the 20% of HTML5, CSS3, JavaScript, TypeScript, React and Node.js that real jobs use.

This repo holds the first three phases of the Learning Platform build plan: **Phase 0** (monorepo, content schema, your 80/20 guides imported as track outlines, CI), **Phase 1** (the public site in semantic HTML5 and CSS3) and **Phase 2** (the first JavaScript: a resource finder and a quiz, written as plain custom elements that the React shell will later host unchanged).

## Quick start

You need **Node.js 24 LTS** (see `.nvmrc`) and **pnpm 11**.

```sh
corepack enable        # once; lets Node.js install the pnpm version pinned in package.json
pnpm install
pnpm dev               # builds the site and serves it at http://localhost:4321
```

On Windows, if `corepack enable` says "permission denied", run it once from a terminal opened as administrator, or use `npm install --global pnpm@11` instead.

To look at the site without installing anything, open `apps/site/dist/index.html` in a browser: the build uses relative links, so it works straight from disk. The sign-up form and the widgets need `pnpm dev`; opened from disk, the resources and quiz pages show their no-JavaScript version instead.

## What's where

| Path | What it is |
| --- | --- |
| `apps/site` | The public site: a small TypeScript generator that turns the content into HTML pages, one CSS file and the JSON the widgets fetch. JavaScript only on the pages with a widget. |
| `apps/shell` | The React 19 + TypeScript learning app (Phase 3). For now a placeholder that builds. |
| `packages/widgets` | The Phase 2 widgets: `<lp-resource-finder>` and `<lp-quiz>`, plain JavaScript custom elements with no build step, type-checked through `// @ts-check` and JSDoc. |
| `packages/content` | All content as JSON: 5 tracks, 179 web resources, your 46-file library and 25 quiz questions. Plus the loader and `check` command. |
| `packages/contracts` | Zod schemas shared by everything: tracks, topics (the five-part template), questions, challenges, the sign-up form, and the shapes of the widgets' JSON. |
| `packages/design-tokens` | Colours, type, spacing and shapes as CSS custom properties, light and dark. Contrast is tested. |
| `packages/platform-kit` | The contract between the shell and its UI modules (`mount`/`unmount`) and a typed event bus. |
| `packages/config` | Shared TypeScript presets: strict base, Node.js, browser. |
| `tools/check-boundaries.ts` | Import rules between packages. |

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Build the site, serve it on port 4321, rebuild when content or CSS changes |
| `pnpm build` | Build every app (`apps/site/dist`, `apps/shell/dist`) |
| `pnpm test` | Unit and build tests (Vitest) in every package |
| `pnpm test:e2e` | Browser checks with Playwright: axe in light and dark, 320px layouts, keyboard, the form, the widgets with and without JavaScript (run `pnpm --filter @lp/site exec playwright install chromium` once first, or set `PW_CHROMIUM_PATH` to an installed Chrome) |
| `pnpm typecheck` | TypeScript 7 in strict mode, every package, including the widgets' JavaScript (`checkJs`) |
| `pnpm lint` / `pnpm fix` | Biome: lint and format check / apply fixes |
| `pnpm check:content` | Validate every content file and cross-reference |
| `pnpm check:boundaries` | Check imports between packages |
| `pnpm validate:html` | html-validate on the built site |
| `pnpm verify` | Everything CI runs, in one go (not `pnpm ci`: that is pnpm's own clean-install command) |

Turborepo caches `build`, `test`, `typecheck` and `check`, so a second run only redoes what changed.

## Content

Content lives in `packages/content/data` and is the source of truth; the site is generated from it.

```text
data/
  tracks/<track-id>.json     modules (weeks), topic outlines, skip list, capstone
  resources.json             every web link, referenced by id
  library.json               the files in your study folders, with their verdicts
  questions/<track-id>.json  quiz and Interview Vault questions, one array per track
  challenges/*.json          Practice Lab challenges (Phase 5)
  theory/<track>/<topic>.md  theory for written topics
```

The tracks were imported once from your 80/20 guides: weeks became modules, "Done when" lists became each module's assessment, skip lists became "Not now", and weekly builds became Practice Lab briefs. The TypeScript track is assembled from the TypeScript weeks of the JavaScript, React, Node.js and Full-Stack guides. From now on, edit the JSON directly and run `pnpm check:content`.

A topic moves through three statuses, and the schema tightens at each step:

1. **outline**: title, priority, module and why it matters (what the import produced).
2. **draft**: the five-part template, in any state: header (summary, level, objectives), theory, code examples, resources, assessment.
3. **published**: exactly three objectives, two to four examples, three to five resources, four to six questions and a coding task.

`pnpm check:content` reports every problem at once, with the file and field, for example
`tracks/react.json topics[2].module: Unknown module "week-9" in track "react"`.

Every topic with quiz questions gets a quiz page, linked from its row in the track's topic table. A question joins a quiz when its `usage` includes `"quiz"` and it is one the browser can mark (`mcq`, `multi_select` or `predict_output`). An outline topic takes all of its quiz questions and a pass mark of 80%; a written topic takes the questions in its assessment, with its own pass mark. The 25 questions in `questions/javascript.json` cover the five JavaScript P0 topics the build plan lists for Phase 2.

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
- [ ] Write the JavaScript P0 lessons (array methods, async/await and `fetch`, DOM events and delegation, closures, the event loop). Their quiz questions are done; the theory, examples and resources are next.

## Conventions

- **Node.js runs TypeScript directly** by stripping types, so there is no build step for scripts and packages. Use only erasable syntax (no `enum`, `namespace` or constructor parameter properties); `tsc` does the type checking.
- **Packages are imported by name** (`@lp/contracts`), never by relative path, and every import is declared in `package.json`. `@lp/contracts` and `@lp/platform-kit` stay free of `node:` imports so the browser can use them.
- **One cascade-layer order** for the site: `reset, tokens, base, layout, components, utilities`. Colours come only from the design tokens.
- **Pages ship no JavaScript unless they hold a widget**, and then only that widget's module, from this origin (the dev server's policy is `script-src 'self'`, with nothing inline). Forms use native validation with `:user-invalid`; the FAQ uses `details` and `summary`.
- **The sign-up form posts to `/api/waitlist`.** The dev server checks it with the shared Zod schema and redirects to the thank-you page, but stores nothing; the Node.js API takes over in Phase 4.

### Widgets

The widgets follow section 2.3 of the architecture doc, so the Phase 3 shell can host them unchanged:

- **Plain JavaScript, no build step.** The site copies `packages/widgets/src` as it is. Each file starts with `// @ts-check` and takes its types from `@lp/contracts` and `@lp/platform-kit` through JSDoc `@import` comments; `tsc` checks them with `checkJs`.
- **One custom element per widget, plus a module.** `<lp-resource-finder src="…">` and `<lp-quiz src="…">` work straight in HTML. Each file's default export is a `UiModule`: `mount(el, ctx)` reads the data URL from `el.dataset.src`, and `unmount(el)` empties `el`.
- **The page's HTML is the fallback.** The site renders the full resource list, or every question with its answer in a `details`, inside the element. The widget's shadow root covers it once the script runs, and shows it again through a `slot` if the data can't load.
- **Text goes in as text.** Widgets build their DOM with `h()` from `dom.js`, which turns every string into a text node; there is no `innerHTML` anywhere, and a build test checks the shipped files for it.
- **Everything stops on disconnect.** Each connection gets an `AbortController`: its signal is on every listener and on the `fetch`, so removing the element removes the listeners and cancels the request.
- **The newest query wins.** The finder numbers its updates and drops any that finish after a newer one has started, so a slow response can never replace newer results.
- **Styles live in the shadow root** (`widgets.css`, linked from it). The page's CSS can't reach in, but the design tokens are custom properties and inherit through, so both themes work.
- **Quiz progress stays in the browser**, under `localStorage` key `lp.quiz.v1.<topic-id>`, until accounts arrive in Phase 4. A passed quiz emits `topic.completed.v1` on the shell's event bus.

## Next: Phase 3

The React shell and the Learning Path: React Router routes for tracks and topics, the Phase 2 widgets mounted unchanged through `ModuleOutlet`, TanStack Query against a mock API, and the React and TypeScript P0 lessons.
