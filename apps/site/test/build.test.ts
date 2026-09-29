import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, posix } from 'node:path';
import { DATA_DIR, loadContent } from '@lp/content';
import type { QuizData, ResourceCatalogue } from '@lp/contracts';
import { HtmlValidate } from 'html-validate';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildSite, renderPages } from '../src/build.ts';

let outDir: string;
let pages: string[];
let data: string[];
const read = (page: string) => readFileSync(join(outDir, page), 'utf8');
const readJson = <T>(file: string): T => JSON.parse(read(file));

/** The written lessons of each track, in catalogue order. */
const WRITTEN: Record<string, string[]> = {
  javascript: ['scope-and-closures', 'arrays-and-objects', 'dom-and-events', 'async-code', 'event-loop'],
  typescript: [
    'types-and-interfaces',
    'unions-and-literal-types',
    'narrowing',
    'reading-generics',
    'discriminated-unions-ui-state',
  ],
  react: [
    'jsx-components-props',
    'lists-and-conditional-rendering',
    'usestate-and-events',
    'useeffect',
    'custom-hooks',
  ],
  nodejs: ['http-and-rest', 'express-5', 'input-validation-zod', 'sql-postgresql-prisma', 'auth'],
};
const WRITTEN_TOPICS = Object.values(WRITTEN).flat();
const LESSON_PAGES = WRITTEN_TOPICS.map((topic) => `lessons/${topic}.html`);
const QUIZ_PAGES = WRITTEN_TOPICS.map((topic) => `quizzes/${topic}.html`);

beforeAll(() => {
  ({ outDir, pages, data } = buildSite({ outDir: mkdtempSync(join(tmpdir(), 'lp-site-')) }));
});
afterAll(() => rmSync(outDir, { recursive: true, force: true }));

describe('the built site', () => {
  it('has the home, catalogue, track, resources, lesson, quiz, sign-up, thanks and 404 pages', () => {
    expect(pages).toEqual([
      'index.html',
      'tracks/index.html',
      'tracks/html-css.html',
      'tracks/javascript.html',
      'tracks/typescript.html',
      'tracks/react.html',
      'tracks/nodejs.html',
      'resources.html',
      ...LESSON_PAGES,
      ...QUIZ_PAGES,
      'signup.html',
      'thanks.html',
      '404.html',
    ]);
    for (const file of ['assets/site.css', 'assets/favicon.svg', 'robots.txt']) {
      expect(existsSync(join(outDir, file)), file).toBe(true);
    }
  });

  it('declares one cascade-layer order before any styles', () => {
    const css = read('assets/site.css');
    expect(css.startsWith('@layer reset, tokens, base, layout, components, utilities;')).toBe(true);
    expect(css).toContain('@media (prefers-color-scheme: dark)');
  });

  it.each([
    'index.html',
    'tracks/index.html',
    'tracks/react.html',
    'resources.html',
    ...LESSON_PAGES,
    'quizzes/event-loop.html',
    'signup.html',
    'thanks.html',
    '404.html',
  ])('%s is a complete page with one h1', (page) => {
    const doc = read(page);
    expect(doc.startsWith('<!DOCTYPE html>\n<html lang="en">')).toBe(true);
    expect(doc.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(doc).toMatch(/<title>[^<]+<\/title>/);
    expect(doc).toMatch(/<meta name="description" content="[^"]+">/);
    expect(doc).toContain('<main id="main"');
  });

  it('loads JavaScript only on widget pages: one module file each, nothing inline', () => {
    for (const page of pages) {
      const doc = read(page);
      const scripts = [...doc.matchAll(/<script\b[^>]*>(.*?)<\/script>/gs)];
      const expected =
        page === 'resources.html'
          ? ['assets/widgets/resource-finder.js']
          : page.startsWith('quizzes/')
            ? ['../assets/widgets/quiz.js']
            : [];
      expect(
        scripts.map((s) => s[0].match(/^<script type="module" src="([^"]+)"><\/script>$/)?.[1]),
        page,
      ).toEqual(expected);
      // No inline handlers: an on…= attribute inside a tag. (Text that mentions one is escaped, so it has no "<".)
      expect(doc, page).not.toMatch(/<[a-z][^>]*\son[a-z]+=/i);
    }
  });

  it('puts a version that works without JavaScript inside each widget', () => {
    const resources = read('resources.html');
    const finder = resources.slice(
      resources.indexOf('<lp-resource-finder'),
      resources.indexOf('</lp-resource-finder>'),
    );
    expect(finder).toContain('<div class="resource-groups">');
    expect(finder.match(/<a href="https:/g)).toHaveLength(loadContent().resources.length);

    const quiz = read('quizzes/event-loop.html');
    expect(quiz).toContain('<lp-quiz src="../data/quizzes/event-loop.json">');
    expect(quiz.match(/<summary>Show the answer<\/summary>/g)).toHaveLength(5);
    // Code is escaped, so the markup in a code sample shows as text.
    expect(read('quizzes/dom-and-events.html')).toContain('// &lt;div id=&quot;outer&quot;&gt;');
  });

  it('writes the resource catalogue the finder fetches', () => {
    const content = loadContent();
    const catalogue = readJson<ResourceCatalogue>('data/resources.json');
    expect(data).toContain('data/resources.json');
    expect(catalogue.tracks.map((t) => t.id)).toEqual(content.tracks.map((t) => t.id));
    expect(catalogue.resources).toHaveLength(content.resources.length);
    for (const r of catalogue.resources) {
      expect(r.host, r.id).not.toMatch(/^www\.|\//);
      expect(r.tracks.length, `${r.id} belongs to no track`).toBeGreaterThan(0);
    }
    const titles = catalogue.resources.map((r) => r.title);
    expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b, 'en')));
  });

  it.each(Object.entries(WRITTEN))(
    'writes a quiz for each %s topic that has questions, linked from its track',
    (trackId, topics) => {
      const track = read(`tracks/${trackId}.html`);
      for (const topic of topics) {
        const quiz = readJson<QuizData>(`data/quizzes/${topic}.json`);
        expect(quiz.topic.id).toBe(topic);
        expect(quiz.track.id).toBe(trackId);
        expect(quiz.passMark).toBe(0.8);
        expect(quiz.questions.length, topic).toBeGreaterThanOrEqual(4);
        for (const q of quiz.questions) expect(q.topic).toBe(topic);
        expect(track).toContain(`<a href="../quizzes/${topic}.html">Quiz: ${quiz.questions.length} questions</a>`);
      }
    },
  );

  it.each(Object.entries(WRITTEN))(
    'writes a lesson for each written %s topic: theory, examples, resources and a coding task',
    (trackId, topics) => {
      const content = loadContent();
      const track = content.tracks.find((t) => t.id === trackId);
      const written = track?.topics.filter((t) => t.status !== 'outline') ?? [];
      expect(written.map((t) => t.id)).toEqual(topics);

      for (const topic of written) {
        const page = read(`lessons/${topic.id}.html`);
        expect(page, topic.id).toContain(`<h1>${topic.title}</h1>`);
        // Every part of the five-part template is on the page.
        expect(
          page.match(/<ul class="done-list">\n(?:<li>.*<\/li>\n){3}<\/ul>/),
          `${topic.id} objectives`,
        ).not.toBeNull();
        expect(
          page.match(/<div class="prose">[\s\S]*?<h2 id="say-it-in-an-interview">/),
          `${topic.id} theory`,
        ).not.toBeNull();
        expect(page.match(/<section class="example" /g)).toHaveLength(topic.examples.length);
        for (const r of topic.resources) {
          const url = content.resources.find((w) => w.id === r.id)?.url;
          expect(page, `${topic.id} links ${r.id}`).toContain(`<a href="${url}">`);
        }
        expect(page).toContain(`<a class="button" href="../quizzes/${topic.id}.html">Take the quiz</a>`);
        for (const id of topic.assessment.challengeIds) {
          const challenge = content.challenges.find((c) => c.id === id);
          expect(page, `${topic.id} task ${id}`).toContain(`<h3>Coding task: ${challenge?.title}</h3>`);
        }
        expect(page.match(/<summary>Hint \d<\/summary>/g)).toHaveLength(3);
        expect(page).toContain('<summary>Show a solution</summary>');
      }
    },
  );

  it('lists what the tests of a coding task check, and escapes its code', () => {
    const page = read('lessons/dom-and-events.html');
    expect(page).toContain('<h4>Done when it</h4>');
    expect(page).toContain('<li>handles elements added after it was set up</li>');
    // The XSS example shows its markup as text.
    expect(page).toContain('{ author: &#39;&lt;img src=x onerror=alert(1)&gt;&#39;, text: &#39;Hi&#39; }');
  });

  it('links lessons to their track, their quiz and each other', () => {
    for (const [trackId, topics] of Object.entries(WRITTEN)) {
      const track = read(`tracks/${trackId}.html`);
      for (const topic of topics) expect(track).toContain(`<a href="../lessons/${topic}.html">Lesson: `);
    }
    const lesson = read('lessons/async-code.html');
    expect(lesson).toContain('<a href="arrays-and-objects.html">Working with arrays and objects</a>'); // read first
    expect(lesson).toContain('<a href="event-loop.html">The event loop lesson</a>'); // a lesson: link in the theory
    expect(lesson).toContain('rel="prev" href="dom-and-events.html"');
    expect(lesson).toContain('rel="next" href="event-loop.html"');
    const quiz = read('quizzes/async-code.html');
    expect(quiz).toContain('<li><a href="../lessons/async-code.html">Async code</a></li>');
    expect(quiz).toContain('<a class="pager__link" href="../lessons/async-code.html">');
    // A lesson can link to one in another track: lesson pages share one folder.
    expect(read('lessons/discriminated-unions-ui-state.html')).toContain('href="lists-and-conditional-rendering.html"');
  });

  it('ships the widgets as written: every import resolves, and text never goes in as HTML', () => {
    const dir = join(outDir, 'assets/widgets');
    const files = readdirSync(dir);
    expect(files).toEqual(
      expect.arrayContaining(['resource-finder.js', 'quiz.js', 'dom.js', 'search.js', 'scoring.js', 'widgets.css']),
    );
    for (const file of files.filter((f) => f.endsWith('.js'))) {
      const source = read(`assets/widgets/${file}`);
      expect(source.startsWith('// @ts-check\n'), `${file} is type-checked`).toBe(true);
      // Runtime imports must be relative files the browser can load. (JSDoc @import lines sit in comments: types for tsc.)
      for (const [, spec = ''] of source.matchAll(/^import .* from '([^']+)';$/gm)) {
        expect(spec, `${file} imports ${spec}`).toMatch(/^\.\/[a-z-]+\.js$/);
        expect(existsSync(join(dir, spec)), `${file} imports ${spec}`).toBe(true);
      }
      for (const [, asset = ''] of source.matchAll(/new URL\('([^']+)', import\.meta\.url\)/g)) {
        expect(existsSync(join(dir, asset)), `${file} links ${asset}`).toBe(true);
      }
      expect(source, file).not.toMatch(/\.(?:innerHTML|outerHTML)\b|insertAdjacentHTML|document\.write/);
    }
  });

  it('links only to pages, files and fragments that exist', () => {
    const broken: string[] = [];
    for (const page of pages.filter((p) => p !== '404.html')) {
      const doc = read(page);
      for (const [, href = ''] of doc.matchAll(/(?:href|src)="([^"]+)"/g)) {
        if (/^https:\/\//.test(href)) continue;
        const [path = '', fragment] = href.split('#');
        const target = path ? posix.join(posix.dirname(page), path) : page;
        if (!existsSync(join(outDir, target))) {
          broken.push(`${page} -> ${href}`);
          continue;
        }
        if (fragment && !read(target).includes(`id="${fragment}"`)) broken.push(`${page} -> ${href} (no such id)`);
      }
    }
    expect(broken).toEqual([]);
  });

  it('labels every form control', () => {
    const doc = read('signup.html');
    const ids = [...doc.matchAll(/<(?:input|select|textarea)[^>]*\sid="([^"]+)"/g)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThan(5);
    for (const id of ids) expect(doc, id).toContain(`<label for="${id}">`);
  });

  it('passes html-validate', async () => {
    const config = JSON.parse(readFileSync(new URL('../.htmlvalidate.json', import.meta.url), 'utf8'));
    const validator = new HtmlValidate(config);
    const problems: string[] = [];
    for (const page of pages) {
      const report = await validator.validateFile(join(outDir, page));
      for (const result of report.results) {
        for (const m of result.messages) problems.push(`${page}:${m.line}:${m.column} ${m.ruleId}: ${m.message}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('stops the build when lesson theory breaks the Markdown rules', () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'lp-content-'));
    try {
      cpSync(DATA_DIR, dataDir, { recursive: true });
      const theory = join(dataDir, 'theory/javascript/event-loop.md');
      writeFileSync(theory, `${readFileSync(theory, 'utf8')}\n## Resources\n\nMore links.\n`);
      expect(() => renderPages(loadContent(dataDir), dataDir)).toThrow(
        'theory/javascript/event-loop.md: the heading id "resources" is already used by the lesson page',
      );
      writeFileSync(theory, '<p>Raw HTML</p>\n');
      expect(() => renderPages(loadContent(dataDir), dataDir)).toThrow(
        'theory/javascript/event-loop.md:1: Unsupported Markdown',
      );
    } finally {
      rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it('writes the 404 page with links from the site root', () => {
    const doc = read('404.html');
    expect(doc).toContain('href="/assets/site.css"');
    expect(doc).toContain('href="/tracks/index.html"');
  });
});
