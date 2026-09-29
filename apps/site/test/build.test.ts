import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, posix } from 'node:path';
import { loadContent } from '@lp/content';
import type { QuizData, ResourceCatalogue } from '@lp/contracts';
import { HtmlValidate } from 'html-validate';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildSite } from '../src/build.ts';

let outDir: string;
let pages: string[];
let data: string[];
const read = (page: string) => readFileSync(join(outDir, page), 'utf8');
const readJson = <T>(file: string): T => JSON.parse(read(file));

const QUIZ_PAGES = [
  'quizzes/scope-and-closures.html',
  'quizzes/arrays-and-objects.html',
  'quizzes/dom-and-events.html',
  'quizzes/async-code.html',
  'quizzes/event-loop.html',
];

beforeAll(() => {
  ({ outDir, pages, data } = buildSite({ outDir: mkdtempSync(join(tmpdir(), 'lp-site-')) }));
});
afterAll(() => rmSync(outDir, { recursive: true, force: true }));

describe('the built site', () => {
  it('has the home, catalogue, track, resources, quiz, sign-up, thanks and 404 pages', () => {
    expect(pages).toEqual([
      'index.html',
      'tracks/index.html',
      'tracks/html-css.html',
      'tracks/javascript.html',
      'tracks/typescript.html',
      'tracks/react.html',
      'tracks/nodejs.html',
      'resources.html',
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

  it('writes a quiz for each topic that has questions, linked from its track', () => {
    const track = read('tracks/javascript.html');
    for (const page of QUIZ_PAGES) {
      const topic = posix.basename(page, '.html');
      const quiz = readJson<QuizData>(`data/quizzes/${topic}.json`);
      expect(quiz.topic.id).toBe(topic);
      expect(quiz.track.id).toBe('javascript');
      expect(quiz.passMark).toBe(0.8);
      expect(quiz.questions.length, topic).toBeGreaterThanOrEqual(4);
      for (const q of quiz.questions) expect(q.topic).toBe(topic);
      expect(track).toContain(`<a href="../${page}">Quiz: ${quiz.questions.length} questions</a>`);
    }
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

  it('writes the 404 page with links from the site root', () => {
    const doc = read('404.html');
    expect(doc).toContain('href="/assets/site.css"');
    expect(doc).toContain('href="/tracks/index.html"');
  });
});
