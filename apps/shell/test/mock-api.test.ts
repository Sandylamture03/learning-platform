// @vitest-environment node
import { loadContent } from '@lp/content';
import {
  API,
  type ApiError,
  type LessonView,
  type Progress,
  type QuizData,
  type TopicProgress,
  type TrackSummary,
  type TrackView,
} from '@lp/contracts';
import { describe, expect, it } from 'vitest';
import { createMockApi } from '../mock-api/handler.ts';

const content = loadContent();
const NOW = new Date('2026-09-29T10:00:00Z');

function setup() {
  const api = createMockApi({ content: () => content, now: () => NOW });
  const call = async <T>(path: string, init?: RequestInit) => {
    const response = await api.handle(new Request(`http://localhost${path}`, init));
    return { status: response.status, headers: response.headers, body: (await response.json()) as T };
  };
  const put = (topicId: string, body: unknown) =>
    call<TopicProgress | ApiError>(API.topicProgress(topicId), {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  return { api, call, put };
}

describe('the mock API', () => {
  it('lists the tracks, in order, with their topics', async () => {
    const { call } = setup();
    const { status, headers, body } = await call<TrackSummary[]>(API.tracks);
    expect(status).toBe(200);
    expect(headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(body.map((t) => t.id)).toEqual(['html-css', 'javascript', 'typescript', 'react', 'nodejs']);
    expect(body[1]?.topics[0]).toMatchObject({ id: 'scope-and-closures', status: 'published', quizSize: 5 });
  });

  it('answers a track, a lesson, a quiz and the resource catalogue', async () => {
    const { call } = setup();
    expect((await call<TrackView>(API.track('react'))).body.title).toBe('React');
    expect((await call<LessonView>(API.lesson('event-loop'))).body.topic.title).toBe('The event loop');
    expect((await call<QuizData>(API.quiz('event-loop'))).body.questions).toHaveLength(5);
    expect((await call<{ resources: unknown[] }>(API.resources)).body.resources).toHaveLength(content.resources.length);
  });

  it('answers 404, with a reason, for what does not exist', async () => {
    const { call } = setup();
    for (const [path, error] of [
      [API.track('cobol'), 'No track called "cobol"'],
      [API.lesson('this-keyword'), 'No lesson for "this-keyword"'],
      [API.quiz('no-such-topic'), 'No quiz for "no-such-topic"'],
      ['/api/nothing-here', 'No API at /api/nothing-here'],
    ]) {
      expect(await call(path ?? ''), path).toEqual(expect.objectContaining({ status: 404, body: { error } }));
    }
  });

  it('answers 405 with the methods a path allows', async () => {
    const { call } = setup();
    const { status, headers } = await call(API.tracks, { method: 'DELETE' });
    expect(status).toBe(405);
    expect(headers.get('allow')).toBe('GET');
  });

  it('records a finished topic, and moves it to the end when it is finished again', async () => {
    const { call, put } = setup();
    expect((await call<Progress>(API.progress)).body).toEqual({ completed: [] });

    const first = await put('event-loop', { trackId: 'javascript', score: 0.8 });
    expect(first).toEqual(
      expect.objectContaining({
        status: 200,
        body: { topicId: 'event-loop', trackId: 'javascript', score: 0.8, completedAt: '2026-09-29T10:00:00.000Z' },
      }),
    );
    await put('async-code', { trackId: 'javascript', score: 1 });
    await put('event-loop', { trackId: 'javascript', score: 1 });
    const { body } = await call<Progress>(API.progress);
    expect(body.completed.map((p) => [p.topicId, p.score])).toEqual([
      ['async-code', 1],
      ['event-loop', 1],
    ]);
  });

  it('checks the progress body at the edge', async () => {
    const { put } = setup();
    expect((await put('event-loop', 'not json')).status).toBe(400);
    const invalid = await put('event-loop', { trackId: 'javascript', score: 2, extra: true });
    expect(invalid.status).toBe(400);
    expect((invalid.body as ApiError).error).toMatch(/score: .*; body: Unrecognized key/);
    expect(await put('event-loop', { trackId: 'react', score: 1 })).toEqual(
      expect.objectContaining({ status: 404, body: { error: 'No topic "event-loop" in track "react"' } }),
    );
  });

  it('keeps each instance’s progress to itself, and forgets it on reset', async () => {
    const one = setup();
    const two = setup();
    await one.put('event-loop', { trackId: 'javascript', score: 1 });
    expect((await two.call<Progress>(API.progress)).body.completed).toEqual([]);
    one.api.reset();
    expect((await one.call<Progress>(API.progress)).body.completed).toEqual([]);
  });

  it('answers 500 with the reason when the content is broken', async () => {
    const api = createMockApi({
      content: () => {
        throw new Error('tracks/react.json topics[2].module: Unknown module "week-9"');
      },
    });
    const response = await api.handle(new Request(`http://localhost${API.tracks}`));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'tracks/react.json topics[2].module: Unknown module "week-9"' });
  });

  it('can wait before answering, so loading states show', async () => {
    const api = createMockApi({ content: () => content, delayMs: 50 });
    const started = performance.now();
    await api.handle(new Request(`http://localhost${API.progress}`));
    expect(performance.now() - started).toBeGreaterThanOrEqual(45);
  });
});
