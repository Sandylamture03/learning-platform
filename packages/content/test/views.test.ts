import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  challengeChecks,
  DATA_DIR,
  lessonView,
  loadContent,
  quizData,
  resourceCatalogue,
  trackSummaries,
  trackView,
} from '../src/index.ts';

const content = loadContent();

describe('trackSummaries', () => {
  it('lists every track in order, with topic summaries for the learning path', () => {
    const tracks = trackSummaries(content);
    expect(tracks.map((t) => t.id)).toEqual(['html-css', 'javascript', 'typescript', 'react', 'nodejs']);
    const javascript = tracks.find((t) => t.id === 'javascript');
    expect(javascript?.topics.find((t) => t.id === 'event-loop')).toEqual({
      id: 'event-loop',
      title: 'The event loop',
      priority: 'P0',
      module: 'week-4',
      why: expect.any(String),
      status: 'published',
      estMinutes: 45,
      quizSize: 5,
    });
    // An outline has no lesson time.
    expect(javascript?.topics.find((t) => t.id === 'this-keyword')).not.toHaveProperty('estMinutes');
  });
});

describe('trackView', () => {
  it('returns the plan with the resources its weeks link to', () => {
    const view = trackView(content, 'javascript');
    expect(view?.modules).toHaveLength(5);
    expect(view?.topics[0]).toMatchObject({ id: 'scope-and-closures', quizSize: 5 });
    for (const id of view?.modules.flatMap((m) => m.resources ?? []) ?? []) {
      expect(view?.linkedResources[id]?.id, id).toBe(id);
    }
  });

  it('returns undefined for a track that does not exist', () => {
    expect(trackView(content, 'cobol')).toBeUndefined();
  });
});

describe('lessonView', () => {
  it('gathers everything a lesson page shows', () => {
    const view = lessonView(content, 'async-code');
    expect(view?.track).toEqual({ id: 'javascript', title: 'JavaScript' });
    expect(view?.module?.id).toBe('week-4');
    expect(view?.theory).toMatch(/^## Why code waits without freezing/);
    expect(view?.resources[0]).toMatchObject({ required: true, resource: { id: 'promises-async-await' } });
    expect(view?.tasks[0]?.challenge.id).toBe('load-profile');
    expect(view?.tasks[0]?.starter).toContain('export async function loadProfile(userId)');
    expect(view?.tasks[0]?.checks).toContain('starts both requests before either one finishes');
    expect(view?.quiz).toEqual({ size: 5, passMark: 0.8 });
    expect(view?.prerequisites).toEqual([
      { id: 'arrays-and-objects', title: 'Working with arrays and objects', trackId: 'javascript', written: true },
    ]);
    expect(view?.previous?.id).toBe('dom-and-events');
    expect(view?.next?.id).toBe('event-loop');
    expect(view?.links.map((l) => l.id)).toEqual(['event-loop']);
  });

  it('returns undefined for an outline or an unknown topic', () => {
    expect(lessonView(content, 'this-keyword')).toBeUndefined();
    expect(lessonView(content, 'no-such-topic')).toBeUndefined();
  });

  it('rejects a lesson: link to a topic that has no lesson', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lp-content-'));
    try {
      cpSync(DATA_DIR, dir, { recursive: true });
      const theory = join(dir, 'theory/javascript/async-code.md');
      writeFileSync(theory, `${readFileSync(theory, 'utf8')}\nSee [this](lesson:this-keyword).\n`);
      expect(() => lessonView(content, 'async-code', dir)).toThrow(
        'theory/javascript/async-code.md: “lesson:this-keyword” is not a written lesson',
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('the widget data', () => {
  it('gives each quiz its questions and pass mark, and the finder every resource', () => {
    expect(quizData(content, 'event-loop')?.questions.map((q) => q.id)).toEqual([
      'event-loop.q01',
      'event-loop.q02',
      'event-loop.q03',
      'event-loop.q04',
      'event-loop.q05',
    ]);
    expect(quizData(content, 'this-keyword')).toBeUndefined();
    expect(resourceCatalogue(content).resources).toHaveLength(content.resources.length);
  });
});

describe('challengeChecks', () => {
  it('reads the names of the test cases', () => {
    expect(
      challengeChecks("describe('x', () => {\n  it('does one thing', () => {});\n  it('does another', () => {});\n});"),
    ).toEqual(['does one thing', 'does another']);
  });
});
