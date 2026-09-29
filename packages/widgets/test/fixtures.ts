import type { QuizData, ResourceCatalogue } from '@lp/contracts';
import { createEventBus, type PlatformContext, type PlatformEvents } from '@lp/platform-kit';
import { vi } from 'vitest';

export const catalogue: ResourceCatalogue = {
  tracks: [
    { id: 'html-css', title: 'HTML5 & CSS3' },
    { id: 'react', title: 'React' },
  ],
  types: [
    { id: 'docs', label: 'Docs' },
    { id: 'video', label: 'Video' },
  ],
  resources: [
    {
      id: 'css-grid',
      title: 'CSS grid layout',
      url: 'https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Grid_layout',
      type: 'docs',
      host: 'developer.mozilla.org',
      tracks: ['html-css'],
    },
    {
      id: 'flexbox-video',
      title: 'Flexbox in 20 minutes',
      url: 'https://www.youtube.com/watch?v=flexbox',
      type: 'video',
      host: 'youtube.com',
      tracks: ['html-css'],
    },
    {
      id: 'react-docs',
      title: 'Quick Start',
      url: 'https://react.dev/learn',
      type: 'docs',
      host: 'react.dev',
      tracks: ['react'],
    },
    {
      id: 'grid-in-react',
      title: 'Grid layouts in React',
      url: 'https://example.com/grid-react',
      type: 'video',
      host: 'example.com',
      tracks: ['html-css', 'react'],
    },
  ],
};

export const quizData: QuizData = {
  track: { id: 'javascript', title: 'JavaScript' },
  topic: { id: 'scope-and-closures', title: 'Scope and closures' },
  passMark: 0.6,
  questions: [
    {
      id: 'scope-and-closures.q01',
      topic: 'scope-and-closures',
      type: 'mcq',
      difficulty: 1,
      priority: 'P0',
      usage: ['quiz'],
      tags: [],
      prompt: 'What is a closure?',
      options: [
        { id: 'a', text: 'A function plus the variables it was created with' },
        { id: 'b', text: 'A block of code in braces' },
      ],
      answer: 'a',
      explanation: 'A function remembers the scope it was written in.',
    },
    {
      id: 'scope-and-closures.q02',
      topic: 'scope-and-closures',
      type: 'multi_select',
      difficulty: 2,
      priority: 'P0',
      usage: ['quiz'],
      tags: [],
      prompt: 'Which create a scope?',
      options: [
        { id: 'a', text: 'A function body' },
        { id: 'b', text: 'An object literal' },
        { id: 'c', text: 'A module' },
      ],
      answers: ['a', 'c'],
      explanation: 'Functions, blocks and modules have scopes; object literals do not.',
    },
    {
      id: 'scope-and-closures.q03',
      topic: 'scope-and-closures',
      type: 'predict_output',
      difficulty: 2,
      priority: 'P0',
      usage: ['quiz'],
      tags: [],
      prompt: 'What does this log?',
      code: 'console.log(a(), b());',
      answer: '3 1',
      explanation: 'Each counter has its own count.',
    },
  ],
};

interface FakeResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

/**
 * Replaces fetch with one that answers every request with `body`. With `hold`, responses wait until `release()`,
 * so a test can decide exactly when the network "answers". Aborting a request's signal rejects it, like fetch.
 */
export function fakeFetch(body: unknown, { status = 200, hold = false } = {}) {
  const requests: { url: string; signal: AbortSignal | undefined; respond: () => void }[] = [];
  const fetch = vi.fn(
    (url: string, init?: { signal?: AbortSignal | undefined }) =>
      new Promise<FakeResponse>((resolve, reject) => {
        const signal = init?.signal;
        if (signal?.aborted) return reject(signal.reason);
        signal?.addEventListener('abort', () => reject(signal.reason));
        const respond = () => resolve({ ok: status < 400, status, json: async () => structuredClone(body) });
        requests.push({ url, signal, respond });
        if (!hold) respond();
      }),
  );
  vi.stubGlobal('fetch', fetch);
  return {
    fetch,
    requests,
    release() {
      for (const request of requests) request.respond();
    },
  };
}

/** Lets every queued promise callback run. */
export async function settle() {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

/** The context the shell will hand a module; only `events` matters to the widgets. */
export function fakeContext(): PlatformContext {
  return {
    user: null,
    locale: 'en',
    theme: 'light',
    getAccessToken: async () => '',
    isEnabled: () => false,
    navigate: () => {},
    events: createEventBus<PlatformEvents>(),
  };
}

/** Narrows away null and undefined, failing the test if the value is missing. */
export function must<T>(value: T | null | undefined, what = 'value'): T {
  if (value === null || value === undefined) throw new Error(`Expected ${what}`);
  return value;
}

/** Records every text the element shows, so a test can check what was ever on screen, not just the end state. */
export function recordText(el: Element): string[] {
  const seen: string[] = [];
  new MutationObserver(() => seen.push(el.textContent ?? '')).observe(el, {
    childList: true,
    characterData: true,
    subtree: true,
  });
  return seen;
}
