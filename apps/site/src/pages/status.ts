import { html } from '../html.ts';
import { layout, type Page } from '../layout.ts';
import { linkFrom, ROUTES } from '../routes.ts';

export function thanksPage(): Page {
  const path = ROUTES.thanks;
  const link = linkFrom(path);
  const main = html`<div class="container">
  <header class="page-head">
    <h1>You are on the list</h1>
    <p class="page-head__lead">Thanks for signing up. We will email you when your track opens.</p>
  </header>
  <p>In the meantime, every track's weekly plan and resources are ready to use.</p>
  <p class="actions"><a class="button" href="${link(ROUTES.tracks)}">Browse the tracks</a></p>
</div>`;
  return {
    path,
    html: layout({ link, title: 'You are on the list', description: 'Thanks for signing up.', noindex: true, main }),
  };
}

export function notFoundPage(): Page {
  const path = ROUTES.notFound;
  // Served for any missing URL, at any depth, so its links start from the site root.
  const link = linkFrom(path, { absolute: true });
  const main = html`<div class="container">
  <header class="page-head">
    <h1>Page not found</h1>
    <p class="page-head__lead">That page does not exist or has moved.</p>
  </header>
  <p class="actions"><a class="button" href="${link(ROUTES.home)}">Go to the home page</a> <a class="button button--secondary" href="${link(ROUTES.tracks)}">Browse the tracks</a></p>
</div>`;
  return {
    path,
    html: layout({ link, title: 'Page not found', description: 'That page does not exist.', noindex: true, main }),
  };
}
