// In production one server answers the whole domain: the API at /api, the learning app at /app/ and the public
// site at /. Serving them from one origin means the session cookie and the site's waitlist form need no CORS.
import { join, sep } from 'node:path';
import { APP_BASE } from '@lp/contracts';
import express, { Router } from 'express';

export interface WebDirs {
  /** The built public site (apps/site/dist). */
  siteDir: string;
  /** The built learning app (apps/shell/dist). */
  appDir: string;
}

/** Where the builds are in this repository, and so in the Docker image. */
export const WEB_DIRS: WebDirs = {
  siteDir: join(import.meta.dirname, '..', '..', 'site', 'dist'),
  appDir: join(import.meta.dirname, '..', '..', 'shell', 'dist'),
};

/** Files whose names carry a content hash never change, so browsers may keep them for a year. */
const IMMUTABLE = 'public, max-age=31536000, immutable';
/** Everything else is checked with the server on each use, so a deploy shows up at once. */
const REVALIDATE = 'no-cache';

export function webRoutes({ siteDir, appDir }: WebDirs): Router {
  const router = Router();
  const app = APP_BASE.replace(/\/$/, ''); // '/app'

  router.use(
    app,
    express.static(appDir, {
      index: false,
      setHeaders: (res, path) => {
        res.set('cache-control', path.includes(`${sep}assets${sep}`) ? IMMUTABLE : REVALIDATE);
      },
    }),
  );
  // A missing build file is a 404, not the app's HTML: a browser asking for a script must not get a page.
  router.use(`${app}/assets`, (_req, res) => {
    res.status(404).type('text/plain').send('Not found\n');
  });
  // Every other path under /app is one of the app's own routes, which it draws itself. (Express ignores a
  // trailing slash when matching, so /app and /app/ both land here; only the bare one is redirected.)
  router.get(`${app}{/*route}`, (req, res) => {
    if (req.path === app) return res.redirect(301, APP_BASE);
    res.set('cache-control', REVALIDATE).sendFile(join(appDir, 'index.html'));
  });

  router.use(
    express.static(siteDir, {
      extensions: ['html'],
      setHeaders: (res) => {
        res.set('cache-control', REVALIDATE);
      },
    }),
  );
  router.use((_req, res) => {
    res.status(404).set('cache-control', REVALIDATE).sendFile(join(siteDir, '404.html'));
  });
  return router;
}
