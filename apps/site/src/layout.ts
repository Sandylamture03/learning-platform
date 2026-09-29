import { html, type SafeHtml } from './html.ts';
import { type Link, ROUTES } from './routes.ts';

export const SITE_NAME = 'Learning Platform';

export interface Page {
  /** Output path inside dist/, e.g. "tracks/react.html". */
  path: string;
  html: string;
}

export interface LayoutOptions {
  link: Link;
  /** The page's own title; the site name is added after it. */
  title: string;
  description: string;
  /** Which main navigation item is the current page. */
  current?: 'tracks' | 'resources' | 'signup';
  /** Keep thank-you and error pages out of search results. */
  noindex?: boolean;
  /** Widget modules the page loads, as dist/ paths. Pages without widgets ship no JavaScript at all. */
  scripts?: readonly string[];
  main: SafeHtml;
}

export function layout(o: LayoutOptions): string {
  const current = (item: LayoutOptions['current']) => (o.current === item ? html` aria-current="page"` : '');
  const doc = html`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${o.title === SITE_NAME ? SITE_NAME : `${o.title} — ${SITE_NAME}`}</title>
<meta name="description" content="${o.description}">
${o.noindex && html`<meta name="robots" content="noindex">`}
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#fbfaf8" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#111318" media="(prefers-color-scheme: dark)">
<link rel="icon" href="${o.link(ROUTES.favicon)}" type="image/svg+xml">
<link rel="stylesheet" href="${o.link(ROUTES.css)}">
${o.scripts?.map((src) => html`<script type="module" src="${o.link(src)}"></script>\n`)}
</head>
<body>
<a class="skip-link" href="#main">Skip to main content</a>
<header class="site-header">
  <div class="container site-header__inner">
    <a class="brand" href="${o.link(ROUTES.home)}"><span class="brand__mark" aria-hidden="true">LP</span> ${SITE_NAME}</a>
    <nav aria-label="Main">
      <ul class="nav-list" role="list">
        <li><a href="${o.link(ROUTES.tracks)}"${current('tracks')}>Tracks</a></li>
        <li><a href="${o.link(ROUTES.resources)}"${current('resources')}>Resources</a></li>
        <li><a class="button button--small" href="${o.link(ROUTES.signup)}"${current('signup')}>Sign up</a></li>
      </ul>
    </nav>
  </div>
</header>
<main id="main" class="site-main">
${o.main}
</main>
<footer class="site-footer">
  <div class="container site-footer__inner">
    <p>${SITE_NAME}: the 20% of HTML5, CSS3, JavaScript, TypeScript, React and Node.js that real jobs use.</p>
    <nav aria-label="Footer">
      <ul class="nav-list" role="list">
        <li><a href="${o.link(ROUTES.home)}">Home</a></li>
        <li><a href="${o.link(ROUTES.tracks)}">Tracks</a></li>
        <li><a href="${o.link(ROUTES.resources)}">Resources</a></li>
        <li><a href="${o.link(ROUTES.signup)}">Sign up</a></li>
      </ul>
    </nav>
  </div>
</footer>
</body>
</html>
`;
  // Tidy the output: templates with optional parts leave blank, indented lines behind.
  return doc.value.replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n');
}
