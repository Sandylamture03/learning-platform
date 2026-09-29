import { posix } from 'node:path';

/** Where each page is written inside dist/. Links between pages are made relative with `linkFrom`. */
export const ROUTES = {
  home: 'index.html',
  tracks: 'tracks/index.html',
  track: (id: string) => `tracks/${id}.html`,
  resources: 'resources.html',
  lesson: (topicId: string) => `lessons/${topicId}.html`,
  quiz: (topicId: string) => `quizzes/${topicId}.html`,
  signup: 'signup.html',
  thanks: 'thanks.html',
  notFound: '404.html',
  css: 'assets/site.css',
  favicon: 'assets/favicon.svg',
  /** The widgets' JavaScript modules and stylesheet, copied as they are from @lp/widgets. */
  widgets: 'assets/widgets',
  widget: (name: WidgetName) => `assets/widgets/${name}.js`,
  /** The JSON the widgets fetch. */
  resourceData: 'data/resources.json',
  quizData: (topicId: string) => `data/quizzes/${topicId}.json`,
} as const;

export type WidgetName = 'resource-finder' | 'quiz';

/** The form's endpoint. The dev server answers it now; the Node.js API takes over in Phase 4. */
export const WAITLIST_ENDPOINT = '/api/waitlist';

export type Link = (to: string) => string;

/**
 * Returns a function that turns a dist/ path into a link from the page at `from`.
 * Relative links keep the site working from any folder, even opened straight from disk.
 * The 404 page is served for any missing URL, so it uses root-absolute links instead.
 */
export function linkFrom(from: string, { absolute = false } = {}): Link {
  return (to) => {
    const [path = '', hash] = to.split('#');
    const suffix = hash === undefined ? '' : `#${hash}`;
    if (absolute) return `/${path}${suffix}`;
    const relative = posix.relative(posix.dirname(from), path);
    return `${relative}${suffix}`;
  };
}
