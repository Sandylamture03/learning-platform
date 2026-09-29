/** The app's URLs, in one place so links and routes agree. */
export const paths = {
  path: '/',
  track: (trackId: string) => `/tracks/${trackId}`,
  lesson: (trackId: string, topicId: string) => `/tracks/${trackId}/${topicId}`,
  resources: '/resources',
  /** The sign-in page, coming back to `next` afterwards. */
  signIn: (next?: string) => withNext('/sign-in', next),
  signUp: (next?: string) => withNext('/sign-up', next),
} as const;

function withNext(page: string, next: string | undefined): string {
  return next && next !== '/' ? `${page}?next=${encodeURIComponent(next)}` : page;
}

/**
 * Where to go after signing in: `next` when it is a path in this app, else the learning path. Anything else
 * (another site, `//evil.example`, `/\evil.example`) would make the sign-in page an open redirect.
 */
export function safeNext(next: string | null): string {
  if (!next?.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return paths.path;
  if (next.startsWith(paths.signIn()) || next.startsWith(paths.signUp())) return paths.path;
  return next;
}
