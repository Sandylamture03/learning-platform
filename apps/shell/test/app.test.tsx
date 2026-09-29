import type { PlatformContext } from '@lp/platform-kit';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { safeNext } from '../src/paths.ts';
import { mockFetch, renderApp } from './render.tsx';

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

/** The progress line on a track's card on the learning path. */
function trackProgress(title: string) {
  const tracks = screen.getByRole('region', { name: 'Tracks' });
  const card = within(tracks).getByRole('link', { name: title }).closest('li');
  if (!card) throw new Error(`No card for ${title}`);
  return within(card).getByText(/ done$| to read$|on the way\.$/).textContent;
}

/** A browser with a signed-in learner, who has finished `topics`. */
async function signedIn(...topics: [trackId: string, topicId: string][]) {
  const requests = mockFetch();
  await requests.signUp();
  await requests.complete(...topics);
  return requests;
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
    // Nobody is signed in, so there is no progress to show, and a way to start saving it.
    await waitFor(() => expect(trackProgress('JavaScript')).toBe('5 lessons to read'));
    expect(['HTML5 & CSS3', 'JavaScript', 'TypeScript', 'React', 'Node.js'].map(trackProgress)).toEqual([
      'Lessons for this track are on the way.',
      '5 lessons to read',
      '5 lessons to read',
      '5 lessons to read',
      'Lessons for this track are on the way.',
    ]);
    expect(screen.getByRole('link', { name: 'Create a free account' }).getAttribute('href')).toBe('/sign-up');
    const start = screen.getByRole('region', { name: 'Start here' });
    expect(within(start).getByRole('link', { name: 'Scope and closures' }).getAttribute('href')).toBe(
      '/tracks/javascript/scope-and-closures',
    );
    await waitFor(() => expect(document.title).toBe('Your learning path — Learning Platform'));
  });

  it('counts a signed-in learner’s finished lessons and suggests the next one', async () => {
    renderApp('/', { requests: await signedIn(['javascript', 'scope-and-closures']) });
    await waitFor(() => expect(trackProgress('JavaScript')).toBe('1 of 5 lessons done'));
    expect(trackProgress('TypeScript')).toBe('0 of 5 lessons done');
    expect(screen.queryByRole('link', { name: 'Create a free account' })).toBeNull();
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
    const { fetch } = renderApp('/tracks/javascript/async-code', { requests: await signedIn() });
    const quiz = await quizElement();
    // The widget reports a pass on the platform's event bus; the shell does the rest.
    quiz.ctx.events.emit('topic.completed.v1', { trackId: 'javascript', topicId: 'async-code', score: 0.8 });

    expect(await screen.findByText('Done: you passed the quiz with 80%.')).toBeTruthy();
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('/api/progress/async-code', expect.objectContaining({ method: 'PUT' })),
    );
    const nav = screen.getByRole('navigation', { name: 'Main' });
    await user.click(within(nav).getByRole('link', { name: 'Learning path' }));
    await waitFor(() => expect(trackProgress('JavaScript')).toBe('1 of 5 lessons done'));
  });

  it('shows a passed quiz at once, and says so when the API does not save it', async () => {
    const user = userEvent.setup();
    // Each progress update waits until the test lets it through, and the first one is refused.
    let release = () => {};
    let refusals = 1;
    let holding = false;
    const requests = mockFetch(async (input, init, next) => {
      if (!holding || init?.method !== 'PUT') return next(input, init);
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      if (refusals-- > 0) return new Response(JSON.stringify({ error: 'The server is restarting' }), { status: 503 });
      return next(input, init);
    });
    await requests.signUp();
    holding = true;
    const { fetch } = renderApp('/tracks/javascript/async-code', { requests });
    const updates = () => fetch.mock.calls.filter(([, init]) => init?.method === 'PUT').length;
    const quiz = await quizElement();
    quiz.ctx.events.emit('topic.completed.v1', { trackId: 'javascript', topicId: 'async-code', score: 0.8 });

    // The result shows before the API has answered…
    expect(await screen.findByText('Done: you passed the quiz with 80%.')).toBeTruthy();
    await waitFor(() => expect(updates()).toBe(1));
    // …and goes again when the API refuses it, with the reason and a way to send it again.
    release();
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Your quiz result could not be saved: The server is restarting.Try again');
    expect(screen.queryByText('Done: you passed the quiz with 80%.')).toBeNull();

    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Done: you passed the quiz with 80%.')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    await waitFor(() => expect(updates()).toBe(2));
    release();
    await waitFor(async () => {
      const progress = await (await requests.fetch('/api/progress')).json();
      expect(progress.completed.map((p: { topicId: string }) => p.topicId)).toEqual(['async-code']);
    });
  });

  it('links a lesson to lessons in other tracks', async () => {
    renderApp('/tracks/typescript/discriminated-unions-ui-state');
    expect(await screen.findByRole('heading', { level: 1, name: 'Discriminated unions for UI state' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'the lists lesson' }).getAttribute('href')).toBe(
      '/tracks/react/lists-and-conditional-rendering',
    );
    expect(screen.getByRole('link', { name: 'the narrowing lesson' }).getAttribute('href')).toBe(
      '/tracks/typescript/narrowing',
    );
    expect(
      screen.getByRole('heading', { level: 3, name: 'Coding task: Make impossible states impossible' }),
    ).toBeTruthy();
  });

  it('moves a lesson filed under the wrong track to its own', async () => {
    const { router } = renderApp('/tracks/react/async-code');
    await waitFor(() => expect(router.state.location.pathname).toBe('/tracks/javascript/async-code'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Async code' })).toBeTruthy();
  });
});

describe('accounts', () => {
  it('signs up from the header, and comes back to the page the learner was on', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/tracks/react');
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    await user.click(await within(nav).findByRole('link', { name: 'Sign in' }));
    expect(router.state.location.search).toBe('?next=%2Ftracks%2Freact');
    await user.click(await screen.findByRole('link', { name: 'Create an account' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Create your account' })).toBeTruthy();

    await user.type(screen.getByLabelText('Name'), 'Asha Rao');
    await user.type(screen.getByLabelText('Email'), 'asha@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct horse battery');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'React' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/tracks/react');
    expect(within(nav).getByText('Asha Rao')).toBeTruthy();
    expect(within(nav).getByRole('button', { name: 'Sign out' })).toBeTruthy();
    expect(screen.getByText('Done')).toBeTruthy(); // the track now shows the learner's progress
  });

  it('names the problem with a field, and marks the field', async () => {
    const user = userEvent.setup();
    const requests = mockFetch();
    const taken = await requests.signUp();
    await requests.fetch('/api/auth/sign-out', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    renderApp('/sign-up', { requests });

    await user.type(await screen.findByLabelText('Name'), 'Sam');
    await user.type(screen.getByLabelText('Email'), taken.email);
    await user.type(screen.getByLabelText('Password'), 'another good password');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect((await screen.findByRole('alert')).textContent).toBe('There is already an account with this email');
    const email = screen.getByLabelText('Email');
    expect(email.getAttribute('aria-invalid')).toBe('true');
    const error = document.getElementById(email.getAttribute('aria-describedby') ?? '');
    expect(error?.textContent).toBe('There is already an account with this email. Sign in instead.');
  });

  it('refuses a wrong password, then signs in with the right one', async () => {
    const user = userEvent.setup();
    const requests = mockFetch();
    const learner = await requests.signUp();
    requests.cookies.clear(); // a different browser
    const { router } = renderApp('/sign-in?next=%2Fresources', { requests });

    await user.type(await screen.findByLabelText('Email'), learner.email);
    await user.type(screen.getByLabelText('Password'), 'not my password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect((await screen.findByRole('alert')).textContent).toBe('That email and password do not match an account');

    await user.clear(screen.getByLabelText('Password'));
    await user.type(screen.getByLabelText('Password'), 'correct horse battery');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/resources'));
  });

  it('keeps a quiz passed while signed out, and saves it once the learner has an account', async () => {
    const user = userEvent.setup();
    const { fetch } = renderApp('/tracks/javascript/async-code');
    const quiz = await quizElement();
    quiz.ctx.events.emit('topic.completed.v1', { trackId: 'javascript', topicId: 'async-code', score: 0.8 });

    const notice = await screen.findByText(/You passed the quiz with 80%/);
    expect(notice.textContent).toBe('You passed the quiz with 80%. Sign in or create an account to save it.');
    await user.click(within(notice).getByRole('link', { name: 'create an account' }));
    await user.type(await screen.findByLabelText('Name'), 'Asha Rao');
    await user.type(screen.getByLabelText('Email'), 'late@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct horse battery');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Done: you passed the quiz with 80%.')).toBeTruthy();
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('/api/progress/async-code', expect.objectContaining({ method: 'PUT' })),
    );
  });

  it('signs out, and stops showing the learner’s progress', async () => {
    const user = userEvent.setup();
    renderApp('/', { requests: await signedIn(['javascript', 'event-loop']) });
    await waitFor(() => expect(trackProgress('JavaScript')).toBe('1 of 5 lessons done'));
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(trackProgress('JavaScript')).toBe('5 lessons to read'));
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Sign in' })).toBeTruthy();
  });

  it('only ever sends the learner back to a page in this app', () => {
    expect(safeNext('/tracks/react/useeffect')).toBe('/tracks/react/useeffect');
    for (const unsafe of [null, '', 'https://evil.example', '//evil.example', '/\\evil.example', '/sign-in?next=/x']) {
      expect(safeNext(unsafe), String(unsafe)).toBe('/');
    }
  });
});

const restarting = () => new Response(JSON.stringify({ error: 'The server is restarting' }), { status: 503 });

describe('when the API fails', () => {
  it('says what did not load, and tries again on request', async () => {
    const user = userEvent.setup();
    // Every request fails until the learner asks again.
    let down = true;
    renderApp('/', { through: (input, init, next) => (down ? Promise.resolve(restarting()) : next(input, init)) });
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('The tracks could not load: The server is restarting.');

    down = false;
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('link', { name: 'JavaScript' })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('says when a signed-in learner’s progress did not load, apart from the rest of the page', async () => {
    const user = userEvent.setup();
    let failures = 1;
    const requests = mockFetch((input, init, next) =>
      String(input) === '/api/progress' && failures-- > 0 ? Promise.resolve(restarting()) : next(input, init),
    );
    await requests.signUp();
    renderApp('/', { requests });
    const progress = await screen.findByRole('alert');
    expect(progress.textContent).toContain('Your progress could not load: The server is restarting.');
    expect(screen.getByRole('link', { name: 'JavaScript' })).toBeTruthy();
    await user.click(within(progress).getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(trackProgress('JavaScript')).toBe('0 of 5 lessons done');
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
