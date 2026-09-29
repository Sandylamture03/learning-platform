import {
  hostOf,
  type Module,
  type Priority,
  RESOURCE_TYPE_LABELS,
  RESOURCE_TYPE_ORDER,
  type Track,
  type WebResource,
} from '@lp/contracts';
import { type HtmlValue, html, type SafeHtml } from '../html.ts';
import { type Link, ROUTES } from '../routes.ts';

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

/** "Five", "Twelve" style for small counts at the start of a sentence; digits above ten. */
export function countWord(n: number): string {
  const word = NUMBER_WORDS[n];
  return word ? word[0]?.toUpperCase() + word.slice(1) : String(n);
}

export function trackStats(track: Track) {
  const p0 = track.topics.filter((t) => t.priority === 'P0').length;
  const topics = track.topics.length;
  // "7 topics (6 P0)", or just "17 topics" when every topic is P0.
  const topicsLabel = p0 === topics ? `${topics} topics` : `${topics} topics (${p0} P0)`;
  return { topics, p0, topicsLabel, modules: track.modules.length };
}

/** "6 weeks · 1–1.5 hours a day" */
export function paceLabel(track: Track): string {
  return `${track.pace.weeks} weeks · ${track.pace.effort}`;
}

/** "Week 3", "Weeks 3–4", or nothing for modules that run alongside other tracks. */
export function weeksLabel(module: Module): string | undefined {
  if (!module.weeks) return undefined;
  const [first, last] = module.weeks;
  return first === last ? `Week ${first}` : `Weeks ${first}–${last}`;
}

export function moduleAnchor(module: Module): string {
  return `module-${module.id}`;
}

export function priorityBadge(priority: Priority): SafeHtml {
  return html`<span class="badge badge--${priority.toLowerCase()}">${priority}</span>`;
}

function resourceItem(r: WebResource): SafeHtml {
  const meta = `${RESOURCE_TYPE_LABELS[r.type]} · ${hostOf(r.url)}`;
  return html`<li><a href="${r.url}">${r.title}</a> <span class="resource-list__meta">${meta}</span></li>\n`;
}

export function resourceList(ids: readonly string[], resources: ReadonlyMap<string, WebResource>): SafeHtml {
  const items = ids.map((id) => resources.get(id)).filter((r): r is WebResource => r !== undefined);
  return html`<ul class="resource-list" role="list">\n${items.map(resourceItem)}</ul>`;
}

/** Resources grouped by type, each group under a heading; `headingLevel` keeps the page outline correct. */
export function resourceGroups(
  ids: readonly string[],
  resources: ReadonlyMap<string, WebResource>,
  headingLevel: 2 | 3,
): SafeHtml {
  const known = ids.map((id) => resources.get(id)).filter((r): r is WebResource => r !== undefined);
  const groups = RESOURCE_TYPE_ORDER.map((type) => ({
    type,
    ids: known.filter((r) => r.type === type).map((r) => r.id),
  }));
  const heading = (text: string) => (headingLevel === 2 ? html`<h2>${text}</h2>` : html`<h3>${text}</h3>`);
  return html`<div class="resource-groups">
${groups
  .filter((g) => g.ids.length > 0)
  .map((g) => html`<div>${heading(RESOURCE_TYPE_LABELS[g.type])}${resourceList(g.ids, resources)}</div>\n`)}</div>`;
}

/** A page section with its h2, labelled by the heading. */
export function section(id: string, title: string, body: HtmlValue): SafeHtml {
  return html`<section class="section" id="${id}" aria-labelledby="${id}-title">
    <h2 id="${id}-title">${title}</h2>
    ${body}
  </section>`;
}

export function textList(items: readonly string[], className = ''): SafeHtml {
  return html`<ul${className && html` class="${className}"`}>
${items.map((item) => html`<li>${item}</li>\n`)}</ul>`;
}

/** A catalogue card; `headingLevel` keeps the page outline correct wherever the card appears. */
export function trackCard(track: Track, link: Link, headingLevel: 2 | 3): SafeHtml {
  const stats = trackStats(track);
  const title = html`<a href="${link(ROUTES.track(track.id))}">${track.title}</a>`;
  return html`<li class="card">
  <p class="card__eyebrow">Track ${track.order}</p>
  ${headingLevel === 2 ? html`<h2 class="card__title">${title}</h2>` : html`<h3 class="card__title">${title}</h3>`}
  <p>${track.summary}</p>
  <ul class="card__meta" role="list">
    <li>${track.pace.weeks} weeks</li>
    <li>${stats.topicsLabel}</li>
    ${track.capstone && html`<li>Capstone: ${track.capstone.title}</li>`}
  </ul>
</li>
`;
}
