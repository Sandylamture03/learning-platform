// The site's sign-up form: a plain HTML form post, answered with a redirect to the thank-you page.
import { WAITLIST_ENDPOINT, WAITLIST_THANKS, waitlistSignup } from '@lp/contracts';
import express, { Router } from 'express';
import type { Deps } from '../app.ts';
import { methodNotAllowed } from '../http.ts';
import { route } from './content.ts';

export function waitlistRoutes({ db, content }: Deps): Router {
  const router = Router();
  const [first, ...rest] = content.tracks.map((t) => t.id);
  if (!first) throw new Error('The content has no tracks, so the waitlist has nothing to offer');
  const Signup = waitlistSignup([first, ...rest]);

  router
    .route(route(WAITLIST_ENDPOINT))
    .post(express.urlencoded({ extended: false, limit: '10kb' }), async (req, res) => {
      if (!req.is('application/x-www-form-urlencoded')) {
        res.status(415).type('text/plain').send('Send the form as application/x-www-form-urlencoded\n');
        return;
      }
      const parsed = Signup.safeParse(req.body);
      if (!parsed.success) {
        // The browser shows this as a page, so it is plain text; the form's own checks catch these first.
        const problems = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
        res.status(400).type('text/plain').send(`The form has problems:\n${problems}\n`);
        return;
      }
      const { name, email, track, level, hoursPerWeek } = parsed.data;
      await db.query(
        `INSERT INTO waitlist (email, name, track, level, hours_per_week) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (email) DO UPDATE
           SET name = excluded.name, track = excluded.track, level = excluded.level,
               hours_per_week = excluded.hours_per_week, updated_at = now()`,
        [email.toLowerCase(), name, track, level, hoursPerWeek],
      );
      // 303 See Other: the browser GETs the thank-you page, so a refresh never posts the form again.
      res.redirect(303, WAITLIST_THANKS);
    })
    .all(methodNotAllowed('POST'));

  return router;
}
