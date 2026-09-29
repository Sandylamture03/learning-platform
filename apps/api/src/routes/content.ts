// The content, read-only: the same views the site builds from and the mock answers with (@lp/content).
import { lessonView, quizData, resourceCatalogue, trackSummaries, trackView } from '@lp/content';
import { API } from '@lp/contracts';
import { Router } from 'express';
import type { Deps } from '../app.ts';
import { HttpError, methodNotAllowed, param } from '../http.ts';

const found = <T>(value: T | undefined, message: string): T => {
  if (value === undefined) throw new HttpError(404, message);
  return value;
};

/** An Express path from a contract path: API.track(':trackId') is /api/tracks/:trackId; the router sits at /api. */
export const route = (path: string) => path.replace(/^\/api/, '');

export function contentRoutes({ content, dataDir }: Deps): Router {
  const router = Router();
  // The content does not change while the server runs, so the lists are worked out once.
  const tracks = trackSummaries(content);
  const catalogue = resourceCatalogue(content);

  router
    .route(route(API.tracks))
    .get((_req, res) => {
      res.json(tracks);
    })
    .all(methodNotAllowed('GET'));
  router
    .route(route(API.track(':trackId')))
    .get((req, res) => {
      const trackId = param(req, 'trackId');
      res.json(found(trackView(content, trackId), `No track called "${trackId}"`));
    })
    .all(methodNotAllowed('GET'));
  router
    .route(route(API.lesson(':topicId')))
    .get((req, res) => {
      const topicId = param(req, 'topicId');
      res.json(found(lessonView(content, topicId, dataDir), `No lesson for "${topicId}"`));
    })
    .all(methodNotAllowed('GET'));
  router
    .route(route(API.quiz(':topicId')))
    .get((req, res) => {
      const topicId = param(req, 'topicId');
      res.json(found(quizData(content, topicId), `No quiz for "${topicId}"`));
    })
    .all(methodNotAllowed('GET'));
  router
    .route(route(API.resources))
    .get((_req, res) => {
      res.json(catalogue);
    })
    .all(methodNotAllowed('GET'));
  return router;
}
