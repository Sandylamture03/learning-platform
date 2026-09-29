// Builds the public site into dist/: `pnpm build` (or `node src/build.ts`).
// Pages are plain HTML and CSS; only pages with a widget load JavaScript, and only the widget's own module.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATA_DIR, loadContent } from '@lp/content';
import type { Content, Topic, Track, WebResource } from '@lp/contracts';
import type { Page } from './layout.ts';
import { homePage } from './pages/home.ts';
import { isWritten, type LessonTask, lessonPage } from './pages/lesson.ts';
import { quizPage } from './pages/quiz.ts';
import { resourcesPage } from './pages/resources.ts';
import { signupPage } from './pages/signup.ts';
import { notFoundPage, thanksPage } from './pages/status.ts';
import { trackPage } from './pages/track.ts';
import { tracksPage } from './pages/tracks.ts';
import { ROUTES } from './routes.ts';
import { resourceCatalogue, topicQuizzes } from './widget-data.ts';

export const SITE_DIR = fileURLToPath(new URL('..', import.meta.url));
export const DIST_DIR = join(SITE_DIR, 'dist');
const STATIC_DIR = join(SITE_DIR, 'static');
/** @lp/widgets' source folder: plain JavaScript and CSS, served exactly as written. */
export const WIDGETS_DIR = dirname(fileURLToPath(import.meta.resolve('@lp/widgets/resource-finder')));

/** One cascade-layer order for the whole site, declared before any styles. */
const LAYER_ORDER = '@layer reset, tokens, base, layout, components, utilities;';

/** The names of a challenge's test cases, it('…'): the lesson lists them as what "done" means. */
function testNames(source: string): string[] {
  return [...source.matchAll(/^\s*it\('([^']+)'/gm)].map((match) => match[1] ?? '');
}

/** A page for every written topic, with its theory and coding tasks read from the content folder. */
function lessonPages(
  content: Content,
  dataDir: string,
  resources: ReadonlyMap<string, WebResource>,
  quizSizes: ReadonlyMap<string, number>,
): Page[] {
  const read = (file: string) => readFileSync(join(dataDir, file), 'utf8').trimEnd();
  const challenges = new Map(content.challenges.map((c) => [c.id, c]));
  const topics = new Map<string, { track: Track; topic: Topic }>(
    content.tracks.flatMap((track) => track.topics.map((topic) => [topic.id, { track, topic }] as const)),
  );
  return content.tracks.flatMap((track) => {
    const written = track.topics.filter(isWritten);
    return written.map((topic, i) => {
      const tasks = topic.assessment.challengeIds.map((id): LessonTask => {
        const challenge = challenges.get(id);
        if (!challenge) throw new Error(`Unknown challenge "${id}"`);
        const checks = testNames(read(challenge.files.tests));
        if (checks.length === 0) throw new Error(`${challenge.files.tests}: no it('…') test cases found`);
        return { challenge, starter: read(challenge.files.starter), solution: read(challenge.files.solution), checks };
      });
      return lessonPage({
        track,
        topic,
        theory: read(topic.theory),
        tasks,
        resources,
        quizSize: quizSizes.get(topic.id) ?? 0,
        topics,
        previous: written[i - 1],
        next: written[i + 1],
      });
    });
  });
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
    ...lessonPages(content, dataDir, resources, quizSizes),
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

export function buildCss(): string {
  const tokens = readFileSync(fileURLToPath(import.meta.resolve('@lp/design-tokens/tokens.css')), 'utf8');
  const site = readFileSync(new URL('./styles/site.css', import.meta.url), 'utf8');
  return `${LAYER_ORDER}\n\n${tokens}\n${site}`;
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
