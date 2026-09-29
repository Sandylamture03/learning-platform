import type { RouteObject } from 'react-router';
import { AppLayout, RouteError } from './layout.tsx';
import { LessonPage } from './pages/LessonPage.tsx';
import { PathPage } from './pages/PathPage.tsx';
import { ResourcesPage } from './pages/ResourcesPage.tsx';
import { TrackPage } from './pages/TrackPage.tsx';
import { NotFound } from './ui.tsx';

function NotFoundPage() {
  return <NotFound message="Nothing lives at this address. The learning path lists every track and lesson." />;
}

/**
 * The app's routes. The layout route draws the header and footer; a pathless route inside it catches errors, so a
 * page that fails keeps the header and the learner can move on. Paths match src/paths.ts.
 */
export const routes: RouteObject[] = [
  {
    Component: AppLayout,
    ErrorBoundary: RouteError,
    children: [
      {
        ErrorBoundary: RouteError,
        children: [
          { index: true, Component: PathPage },
          {
            path: 'tracks/:trackId',
            children: [
              { index: true, Component: TrackPage },
              { path: ':topicId', Component: LessonPage },
            ],
          },
          { path: 'resources', Component: ResourcesPage },
          { path: '*', Component: NotFoundPage },
        ],
      },
    ],
  },
];
