/** The app's URLs, in one place so links and routes agree. */
export const paths = {
  path: '/',
  track: (trackId: string) => `/tracks/${trackId}`,
  lesson: (trackId: string, topicId: string) => `/tracks/${trackId}/${topicId}`,
  resources: '/resources',
} as const;
