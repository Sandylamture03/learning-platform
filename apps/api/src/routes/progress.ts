// Each learner's finished topics. Only the signed-in learner can read or change their own.
import { API, type Progress, ProgressUpdate, type TopicProgress, type User } from '@lp/contracts';
import { type Response, Router } from 'express';
import type { Deps } from '../app.ts';
import { HttpError, methodNotAllowed, param, parseBody } from '../http.ts';
import { route } from './content.ts';

interface Row {
  topic_id: string;
  track_id: string;
  score: number;
  completed_at: Date;
}

const toProgress = (row: Row): TopicProgress => ({
  topicId: row.topic_id,
  trackId: row.track_id,
  score: row.score,
  completedAt: row.completed_at.toISOString(),
});

function signedIn(res: Response, message: string): User {
  const { user } = res.locals;
  if (!user) throw new HttpError(401, message);
  return user;
}

export function progressRoutes({ db, content, now }: Deps): Router {
  const router = Router();

  router
    .route(route(API.progress))
    .get(async (_req, res) => {
      const user = signedIn(res, 'Sign in to see your progress');
      const { rows } = await db.query<Row>(
        `SELECT topic_id, track_id, score, completed_at FROM progress
          WHERE user_id = $1 ORDER BY completed_at, topic_id`,
        [user.id],
      );
      res.json({ completed: rows.map(toProgress) } satisfies Progress);
    })
    .all(methodNotAllowed('GET'));

  router
    .route(route(API.topicProgress(':topicId')))
    .put(async (req, res) => {
      const user = signedIn(res, 'Sign in to save your progress');
      const topicId = param(req, 'topicId');
      const { trackId, score } = parseBody(ProgressUpdate, req.body);
      const track = content.tracks.find((t) => t.id === trackId);
      if (!track?.topics.some((t) => t.id === topicId)) {
        throw new HttpError(404, `No topic "${topicId}" in track "${trackId}"`);
      }
      const { rows } = await db.query<Row>(
        `INSERT INTO progress (user_id, topic_id, track_id, score, completed_at) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, topic_id) DO UPDATE
           SET track_id = excluded.track_id, score = excluded.score, completed_at = excluded.completed_at
         RETURNING topic_id, track_id, score, completed_at`,
        [user.id, topicId, trackId, score, now()],
      );
      res.json(toProgress(rows[0] as Row));
    })
    .all(methodNotAllowed('PUT'));

  return router;
}
