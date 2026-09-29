import type { Content } from '@lp/contracts';
import { html } from '../html.ts';
import { layout, type Page } from '../layout.ts';
import { linkFrom, ROUTES } from '../routes.ts';
import { resourceGroups } from './parts.ts';

export function resourcesPage(content: Content): Page {
  const path = ROUTES.resources;
  const link = linkFrom(path);
  const resources = new Map(content.resources.map((r) => [r.id, r]));
  const ids = [...content.resources].sort((a, b) => a.title.localeCompare(b.title, 'en')).map((r) => r.id);

  // The finder's children are what shows without JavaScript: the full list, grouped by type.
  const main = html`<div class="container">
  <nav class="breadcrumb" aria-label="Breadcrumb">
    <ol role="list">
      <li><a href="${link(ROUTES.home)}">Home</a></li>
      <li><a href="${link(path)}" aria-current="page">Resources</a></li>
    </ol>
  </nav>
  <header class="page-head">
    <h1>Resources</h1>
    <p class="page-head__lead">Every free doc, video, course and tool the tracks link to: ${content.resources.length} in all.</p>
  </header>

  <lp-resource-finder src="${link(ROUTES.resourceData)}">
    ${resourceGroups(ids, resources, 2)}
  </lp-resource-finder>
</div>`;

  return {
    path,
    html: layout({
      link,
      title: 'Resources',
      description: `Search and filter the ${content.resources.length} free resources the tracks use, by track and type.`,
      current: 'resources',
      scripts: [ROUTES.widget('resource-finder')],
      main,
    }),
  };
}
