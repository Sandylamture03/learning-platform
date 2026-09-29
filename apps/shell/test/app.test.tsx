import { loadContent } from '@lp/content';
import type { PlatformContext } from '@lp/platform-kit';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMockApi } from '../mock-api/handler.ts';
import { callApi, complete, renderApp } from './render.tsx';

const content = loadContent();

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

/** The quiz widget's element, once ModuleOutlet has mounted it. */
async function quizElement() {
  let quiz: (Element & { ctx?: PlatformContext }) | null = null;
  await waitFor(() => {
    quiz = document.querySelector('lp-quiz');
    expect(quiz).not.toBeNull();
  });
  return quiz as unknown as HTMLElement & { ctx: PlatformContext };
}

describe('the learning path', () => {
  it('lists the tracks with their lessons, and where to start', async () => {
    renderApp('/');
    expect(await screen.findByRole('heading', { level: 1, name: 'Your learning path' })).toBeTruthy();
    const tracks = await screen.findByRole('region', { name: 'Tracks' });
    expect(
      within(tracks)
        .getAllByRole('heading', { level: 3 })
        .map((h) => h.textContent),
    ).toEqual(['HTML5 & CSS3', 'JavaScript', 'TypeScript', 'React', 'Node.js']);
    expect(screen.getByText('0 of 5 lessons done')).toBeTruthy();
    const start = screen.getByRole('region', { name: 'Start here' });
    expect(within(start).getByRole('link', { name: 'Scope and closures' }).getAttribute('href')).toBe(
      '/tracks/javascript/scope-and-closures',
    );
    await waitFor(() => expect(document.title).toBe('Your learning path — Learning Platform'));
  });

  it('counts finished lessons and suggests the next one', async () => {
    const api = createMockApi({ content: () => content });
    await complete(api, ['javascript', 'scope-and-closures']);
    renderApp('/', { api });
    expect(await screen.findByText('1 of 5 lessons done')).toBeTruthy();
    const next = await screen.findByRole('region', { name: 'Up next' });
    expect(within(next).getByRole('link', { name: 'Working with arrays and objects' })).toBeTruthy();
  });
});

describe('a track', () => {
  it('shows the weekly plan, linking written topics to their lessons', async () => {
    renderApp('/tracks/javascript');
    expect(await screen.findByRole('heading', { level: 1, name: 'JavaScript' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Scope and closures' }).getAttribute('href')).toBe(
      '/tracks/javascript/scope-and-closures',
    );
    // An outline has no lesson yet, so it is not a link.
    expect(screen.getByText('this and classes')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'this and classes' })).toBeNull();
    const weeks = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(weeks.slice(0, 2)).toEqual(['Week 1: Everyday fundamentals', 'Week 2: Arrays and objects']);
  });
});

describe('not found', () => {
  it.each([
    ['/tracks/cobol', 'Track not found'],
    ['/tracks/javascript/this-keyword', 'Lesson not found'],
    ['/no/such/page', 'Page not found'],
  ])('%s says so, and links back to the learning path', async (path, title) => {
    renderApp(path);
    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Go to your learning path' }).getAttribute('href')).toBe('/');
  });
});

describe('a lesson', () => {
  it('shows the theory, examples, resources and coding task', async () => {
    renderApp('/tracks/javascript/async-code');
    expect(await screen.findByRole('heading', { level: 1, name: 'Async code' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'fetch, properly' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'fetch, properly' }).getAttribute('href')).toBe('#fetch-properly');
    // A lesson: link in the theory becomes a link inside the app.
    expect(screen.getByRole('link', { name: 'The event loop lesson' }).getAttribute('href')).toBe(
      '/tracks/javascript/event-loop',
    );
    expect(screen.getByRole('link', { name: 'Working with arrays and objects' }).getAttribute('href')).toBe(
      '/tracks/javascript/arrays-and-objects',
    );
    expect(screen.getByRole('heading', { level: 3, name: 'Loading, error and success' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'MDN: Using Fetch' }).getAttribute('href')).toMatch(/^https:\/\//);
    expect(screen.getByRole('heading', { level: 3, name: 'Coding task: Load a profile in parallel' })).toBeTruthy();
    expect(screen.getByText('starts both requests before either one finishes')).toBeTruthy();
    await waitFor(() => expect(document.title).toBe('JavaScript: Async code — Learning Platform'));
  });

  it('mounts the quiz widget through ModuleOutlet, and unmounts it when the learner moves on', async () => {
    const user = userEvent.setup();
    renderApp('/tracks/javascript/async-code');
    const first = await quizElement();
    expect(first.getAttribute('src')).toBe('/api/quizzes/async-code');
    await waitFor(() => expect(first.shadowRoot?.textContent).toContain('Answered 0 of 5, 0 right.'));

    const pager = screen.getByRole('navigation', { name: 'Lessons' });
    await user.click(within(pager).getByRole('link', { name: 'The event loop' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'The event loop' })).toBeTruthy();
    await waitFor(() => expect(document.querySelector('lp-quiz')?.getAttribute('src')).toBe('/api/quizzes/event-loop'));
    expect(first.isConnected).toBe(false);
    expect(document.querySelectorAll('lp-quiz')).toHaveLength(1);
  });

  it('records a passed quiz, and shows it on the lesson and the learning path', async () => {
    const user = userEvent.setup();
    const { fetch } = renderApp('/tracks/javascript/async-code');
    const quiz = await quizElement();
    // The widget reports a pass on the platform's event bus; the shell does the rest.
    quiz.ctx.events.emit('topic.completed.v1', { trackId: 'javascript', topicId: 'async-code', score: 0.8 });

    expect(await screen.findByText('Done: you passed the quiz with 80%.')).toBeTruthy();
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('/api/progress/async-code', expect.objectContaining({ method: 'PUT' })),
    );
    const nav = screen.getByRole('navigation', { name: 'Main' });
    await user.click(within(nav).getByRole('link', { name: 'Learning path' }));
    expect(await screen.findByText('1 of 5 lessons done')).toBeTruthy();
  });

  it('moves a lesson filed under the wrong track to its own', async () => {
    const { router } = renderApp('/tracks/react/async-code');
    await waitFor(() => expect(router.state.location.pathname).toBe('/tracks/javascript/async-code'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Async code' })).toBeTruthy();
  });
});

describe('when the API fails', () => {
  it('says what did not load, and tries again on request', async () => {
    const user = userEvent.setup();
    const api = createMockApi({ content: () => content });
    // Every request fails until the learner asks again.
    let down = true;
    renderApp('/', {
      api,
      fetch: async (input, init) =>
        down
          ? new Response(JSON.stringify({ error: 'The server is restarting' }), { status: 503 })
          : callApi(api, input, init),
    });
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('The tracks could not load: The server is restarting.');

    down = false;
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('link', { name: 'JavaScript' })).toBeTruthy();
    // Progress failed too, and says so on its own; it loads when asked again.
    const progress = await screen.findByRole('alert');
    expect(progress.textContent).toContain('Your progress could not load');
    await user.click(within(progress).getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });
});

describe('navigation', () => {
  it('moves focus to the main content after a client-side navigation', async () => {
    const user = userEvent.setup();
    renderApp('/');
    await user.click(await screen.findByRole('link', { name: 'JavaScript' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'JavaScript' })).toBeTruthy();
    expect(document.activeElement?.id).toBe('main');
  });

  it('marks the current section in the main navigation', async () => {
    renderApp('/resources');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Resources' }).getAttribute('aria-current')).toBe('page');
    expect(within(nav).getByRole('link', { name: 'Learning path' }).getAttribute('aria-current')).toBeNull();
    await waitFor(() =>
      expect(document.querySelector('lp-resource-finder')?.getAttribute('src')).toBe('/api/resources'),
    );
  });
});
