// Builds the public site into dist/: `pnpm build` (or `node src/build.ts`).
// Pages are plain HTML and CSS; only pages with a widget load JavaScript, and only the widget's own module.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATA_DIR, lessonView, loadContent, resourceCatalogue, topicQuizzes } from '@lp/content';
import { type Content, isWritten, type WebResource } from '@lp/contracts';
import type { Page } from './layout.ts';
import { homePage } from './pages/home.ts';
import { lessonPage } from './pages/lesson.ts';
import { quizPage } from './pages/quiz.ts';
import { resourcesPage } from './pages/resources.ts';
import { signupPage } from './pages/signup.ts';
import { notFoundPage, thanksPage } from './pages/status.ts';
import { trackPage } from './pages/track.ts';
import { tracksPage } from './pages/tracks.ts';
import { ROUTES } from './routes.ts';

export const SITE_DIR = fileURLToPath(new URL('..', import.meta.url));
export const DIST_DIR = join(SITE_DIR, 'dist');
const STATIC_DIR = join(SITE_DIR, 'static');
/** @lp/widgets' source folder: plain JavaScript and CSS, served exactly as written. */
export const WIDGETS_DIR = dirname(fileURLToPath(import.meta.resolve('@lp/widgets/resource-finder')));
/** @lp/styles' folder: the stylesheet the site shares with the learning app. */
export const STYLES_DIR = dirname(fileURLToPath(import.meta.resolve('@lp/styles/styles.css')));

/** A page for every written topic, with its theory and coding tasks read from the content folder. */
function lessonPages(content: Content, dataDir: string): Page[] {
  return content.tracks.flatMap((track) =>
    track.topics.filter(isWritten).map((topic) => {
      const view = lessonView(content, topic.id, dataDir);
      if (!view) throw new Error(`No lesson for "${topic.id}"`);
      return lessonPage(view);
    }),
  );
}

export function renderPages(content: Content, dataDir: string = DATA_DIR): Page[] {
  const resources = new Map<string, WebResource>(content.resources.map((r) => [r.id, r]));
  const { tracks } = content;
  const quizzes = topicQuizzes(content);
  const quizSizes = new Map(quizzes.map((q) => [q.topic.id, q.quiz.questions.length]));
  return [
    homePage(content),
    tracksPage(content),
    ...tracks.map((track, i) =>
      trackPage({ track, resources, quizzes: quizSizes, previous: tracks[i - 1], next: tracks[i + 1] }),
    ),
    resourcesPage(content),
    ...lessonPages(content, dataDir),
    ...quizzes.map((q, i) => {
      const next = quizzes[i + 1];
      return quizPage({ ...q, next: next?.track.id === q.track.id ? next : undefined });
    }),
    signupPage(content),
    thanksPage(),
    notFoundPage(),
  ];
}

/** The JSON files the widgets fetch, by dist/ path. */
export function renderData(content: Content): { path: string; json: string }[] {
  const json = (data: unknown) => `${JSON.stringify(data)}\n`;
  return [
    { path: ROUTES.resourceData, json: json(resourceCatalogue(content)) },
    ...topicQuizzes(content).map(({ quiz }) => ({ path: ROUTES.quizData(quiz.topic.id), json: json(quiz) })),
  ];
}

/** One file: the cascade-layer order first, then the tokens, then the shared styles. */
export function buildCss(): string {
  const read = (specifier: string) => readFileSync(fileURLToPath(import.meta.resolve(specifier)), 'utf8');
  return `${read('@lp/styles/layers.css')}\n${read('@lp/design-tokens/tokens.css')}\n${read('@lp/styles/styles.css')}`;
}

function write(file: string, text: string) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
}

export function buildSite({
  outDir = DIST_DIR,
  dataDir = DATA_DIR,
  content = loadContent(dataDir),
}: {
  outDir?: string;
  dataDir?: string;
  content?: Content;
} = {}) {
  rmSync(outDir, { recursive: true, force: true });
  const pages = renderPages(content, dataDir);
  const data = renderData(content);
  for (const page of pages) write(join(outDir, page.path), page.html);
  for (const file of data) write(join(outDir, file.path), file.json);
  write(join(outDir, ROUTES.css), buildCss());
  cpSync(WIDGETS_DIR, join(outDir, ROUTES.widgets), { recursive: true });
  cpSync(STATIC_DIR, outDir, { recursive: true });
  return { outDir, pages: pages.map((p) => p.path), data: data.map((d) => d.path) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const started = performance.now();
  const { outDir, pages } = buildSite();
  const ms = Math.round(performance.now() - started);
  console.log(`Built ${pages.length} pages into ${relative(process.cwd(), outDir) || '.'} in ${ms} ms`);
}
