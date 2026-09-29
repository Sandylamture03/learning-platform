import type { Content } from '@lp/contracts';
import { html } from '../html.ts';
import { layout, type Page } from '../layout.ts';
import { linkFrom, ROUTES } from '../routes.ts';
import { countWord, trackCard } from './parts.ts';

export function tracksPage(content: Content): Page {
  const path = ROUTES.tracks;
  const link = linkFrom(path);
  const names = new Intl.ListFormat('en', { type: 'conjunction' }).format(content.tracks.map((t) => t.title));

  const main = html`<div class="container">
  <nav class="breadcrumb" aria-label="Breadcrumb">
    <ol role="list">
      <li><a href="${link(ROUTES.home)}">Home</a></li>
      <li><a href="${link(ROUTES.tracks)}" aria-current="page">Tracks</a></li>
    </ol>
  </nav>
  <header class="page-head">
    <h1>Tracks</h1>
    <p class="page-head__lead">${countWord(content.tracks.length)} tracks, in the order most learners take them. Each one lists its weekly plan, the topics that matter most, the resources to use and what to skip for now.</p>
  </header>
  <ol class="card-grid" role="list">
${content.tracks.map((t) => trackCard(t, link, 2))}  </ol>
</div>`;

  return {
    path,
    html: layout({
      link,
      title: 'Tracks',
      description: `${content.tracks.length} tracks: ${names}, each cut down to the 20% that real jobs use.`,
      current: 'tracks',
      main,
    }),
  };
}
