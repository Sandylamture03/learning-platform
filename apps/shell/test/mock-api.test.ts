// @vitest-environment node
import { loadContent } from '@lp/content';
import {
  API,
  type ApiError,
  type LessonView,
  type Me,
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

/** A mock API and one browser talking to it, keeping the session cookie it is given. */
function setup() {
  let cookies: string | undefined;
  const api = createMockApi({
    content: () => content,
    now: () => NOW,
    onSetCookie: (cookie) => {
      const [pair = ''] = cookie.split(';');
      cookies = pair.endsWith('=') ? undefined : pair;
    },
  });
  const call = async <T>(path: string, init?: RequestInit) => {
    const response = await api.handle(new Request(`http://localhost${path}`, init), cookies);
    const body = response.status === 204 ? undefined : await response.json();
    return { status: response.status, headers: response.headers, body: body as T };
  };
  const send = <T>(method: string, path: string, body: unknown) =>
    call<T>(path, {
      method,
      headers: { 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  const put = (topicId: string, body: unknown) =>
    send<TopicProgress | ApiError>('PUT', API.topicProgress(topicId), body);
  const signUp = (email = 'asha@example.com') =>
    send<Me & ApiError>('POST', API.signUp, { name: 'Asha Rao', email, password: 'correct horse battery' });
  return { api, call, send, put, signUp, cookies: () => cookies };
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

  it('signs up, in and out, with a session cookie like the real API’s', async () => {
    const { call, send, signUp, cookies } = setup();
    expect((await call<Me>(API.me)).body).toEqual({ user: null });
    const up = await signUp();
    expect(up.status).toBe(201);
    expect(up.body.user).toEqual({ id: expect.any(String), name: 'Asha Rao', email: 'asha@example.com' });
    expect(cookies()).toMatch(/^lp_session=/);
    expect((await call<Me>(API.me)).body.user?.name).toBe('Asha Rao');

    expect((await send('POST', API.signOut, {})).status).toBe(204);
    expect(cookies()).toBeUndefined();
    expect((await call<Me>(API.me)).body).toEqual({ user: null });

    const wrong = await send<ApiError>('POST', API.signIn, { email: 'asha@example.com', password: 'nope' });
    expect(wrong).toMatchObject({ status: 401, body: { error: 'That email and password do not match an account' } });
    const right = await send<Me>('POST', API.signIn, { email: 'ASHA@example.com', password: 'correct horse battery' });
    expect(right.body.user?.email).toBe('asha@example.com');
  });

  it('refuses a taken email and names bad fields, as the real API does', async () => {
    const { signUp, send } = setup();
    await signUp();
    const again = await signUp('Asha@Example.com');
    expect(again).toMatchObject({
      status: 409,
      body: { fields: { email: expect.stringContaining('Sign in instead') } },
    });
    const bad = await send<ApiError>('POST', API.signUp, { name: '', email: 'nope', password: 'short' });
    expect(bad.body.fields).toEqual({
      name: 'Enter your name',
      email: 'Enter an email address like name@example.com',
      password: 'Use at least 8 characters',
    });
    expect((await send('POST', API.signIn, 'email=a')).status).toBe(400);
  });

  it('keeps progress for signed-in learners only', async () => {
    const { call, put } = setup();
    expect(await call(API.progress)).toMatchObject({ status: 401, body: { error: 'Sign in to see your progress' } });
    expect((await put('event-loop', { trackId: 'javascript', score: 1 })).status).toBe(401);
  });

  it('records a finished topic, and moves it to the end when it is finished again', async () => {
    const { call, put, signUp } = setup();
    await signUp();
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
    const { put, signUp } = setup();
    await signUp();
    expect((await put('event-loop', 'not json')).status).toBe(400);
    const invalid = await put('event-loop', { trackId: 'javascript', score: 2, extra: true });
    expect(invalid.status).toBe(400);
    expect(Object.keys((invalid.body as ApiError).fields ?? {})).toEqual(['score', 'body']);
    expect(await put('event-loop', { trackId: 'react', score: 1 })).toEqual(
      expect.objectContaining({ status: 404, body: { error: 'No topic "event-loop" in track "react"' } }),
    );
  });

  it('keeps each instance’s accounts and progress to itself, and forgets them on reset', async () => {
    const one = setup();
    const two = setup();
    await one.signUp();
    await one.put('event-loop', { trackId: 'javascript', score: 1 });
    expect((await two.signUp()).status).toBe(201); // the same email is free in another instance
    expect((await two.call<Progress>(API.progress)).body.completed).toEqual([]);
    one.api.reset();
    expect((await one.call<Me>(API.me)).body).toEqual({ user: null });
    expect((await one.signUp()).status).toBe(201);
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
