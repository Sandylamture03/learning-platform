import type { Module, SkipItem, Topic, Track, WebResource } from '@lp/contracts';
import { type HtmlValue, html, join, type SafeHtml } from '../html.ts';
import { layout, type Page } from '../layout.ts';
import { type Link, linkFrom, ROUTES } from '../routes.ts';
import {
  moduleAnchor,
  paceLabel,
  priorityBadge,
  resourceGroups,
  resourceList,
  section,
  textList,
  trackStats,
  weeksLabel,
} from './parts.ts';

type Resources = ReadonlyMap<string, WebResource>;

interface TrackPageInput {
  track: Track;
  resources: Resources;
  /** How many quiz questions each topic has, for the topics that have a quiz. */
  quizzes: ReadonlyMap<string, number>;
  previous?: Track | undefined;
  next?: Track | undefined;
}

const STATUS_NOTE: Record<Track['status'], string> = {
  outline:
    'This track is an outline: the plan, topics and resources are ready, and written lessons arrive topic by topic.',
  draft: 'Lessons for this track are being written; some topics are still outlines.',
  published: 'Every topic in this track has a written lesson and a quiz.',
};

export const topicAnchor = (topic: Pick<Topic, 'id'>) => `topic-${topic.id}`;

/** One labelled block inside a module: "What you learn", "Build", "Done when"… */
function part(title: HtmlValue, body: HtmlValue): SafeHtml {
  return html`<div class="module__part"><h4>${title}</h4>${body}</div>`;
}

function moduleSection(track: Track, module: Module, resources: Resources): SafeHtml {
  const id = moduleAnchor(module);
  const weeks = weeksLabel(module);
  const label = weeks && html`<span class="module__weeks">${weeks}<span class="visually-hidden">:</span></span> `;
  const topics = track.topics
    .filter((t) => t.module === module.id)
    .map((t) => html`<a href="#${topicAnchor(t)}">${t.title}</a>`);
  const { build } = module;
  const buildBody = build && [build.brief && html`<p>${build.brief}</p>`, build.checklist && textList(build.checklist)];

  return html`<section class="module" aria-labelledby="${id}">
  <h3 id="${id}">${label}${module.title}</h3>
  ${module.goal && html`<p class="module__goal">${module.goal}</p>`}
  ${topics.length > 0 && html`<p class="module__topics">Topics: ${join(topics, ', ')}</p>`}
  <div class="module__grid">
    ${module.learn && part('What you learn', textList(module.learn))}
    ${build && part(`Build: ${build.title}`, buildBody)}
    ${module.doneWhen && part('Done when', textList(module.doneWhen, 'done-list'))}
    ${module.resources && part('Resources', resourceList(module.resources, resources))}
    ${module.notNow && part('Not now', textList(module.notNow))}
  </div>
</section>
`;
}

function topicRow(topic: Topic, modules: ReadonlyMap<string, Module>, link: Link, questions?: number): SafeHtml {
  const module = modules.get(topic.module);
  const where = module && html`<a href="#${moduleAnchor(module)}">${weeksLabel(module) ?? module.title}</a>`;
  const lesson =
    topic.status !== 'outline' &&
    html`<span class="data-table__where"><a href="${link(ROUTES.lesson(topic.id))}">Lesson: ${topic.estMinutes} minutes</a></span>`;
  const quiz =
    questions &&
    html`<span class="data-table__where"><a href="${link(ROUTES.quiz(topic.id))}">Quiz: ${questions} questions</a></span>`;
  return html`      <tr id="${topicAnchor(topic)}">
        <th scope="row">${topic.title} ${priorityBadge(topic.priority)}<span class="data-table__where">${where}</span>${lesson}${quiz}</th>
        <td>${topic.why}</td>
      </tr>
`;
}

function topicTable(track: Track, link: Link, quizzes: ReadonlyMap<string, number>): SafeHtml {
  const modules = new Map(track.modules.map((m) => [m.id, m]));
  return html`<div class="table-scroll">
  <table class="data-table">
    <caption>The ${track.topics.length} topics in the ${track.title} track</caption>
    <thead>
      <tr><th scope="col">Topic and week</th><th scope="col">Why it is in the 20%</th></tr>
    </thead>
    <tbody>
${track.topics.map((t) => topicRow(t, modules, link, quizzes.get(t.id)))}    </tbody>
  </table>
</div>`;
}

function skipItem(s: SkipItem): SafeHtml {
  const why = s.why && html` — ${s.why}`;
  const instead = s.instead && html`<span class="skip-list__instead">Instead: ${s.instead}</span>`;
  return html`<li><strong>${s.item}</strong>${why}${instead}</li>\n`;
}

function pager(link: Link, previous: Track | undefined, next: Track | undefined): SafeHtml {
  const back =
    previous &&
    html`<a class="pager__link" rel="prev" href="${link(ROUTES.track(previous.id))}"><span aria-hidden="true">←</span> ${previous.title}</a>`;
  const forward =
    next &&
    html`<a class="pager__link pager__link--next" rel="next" href="${link(ROUTES.track(next.id))}">${next.title} <span aria-hidden="true">→</span></a>`;
  return html`<nav class="pager" aria-label="Other tracks">
  ${back}
  ${forward}
</nav>`;
}

function intro(text: HtmlValue): SafeHtml {
  return html`<p class="section__intro">${text}</p>`;
}

export function trackPage({ track, resources, quizzes, previous, next }: TrackPageInput): Page {
  const path = ROUTES.track(track.id);
  const link = linkFrom(path);
  const stats = trackStats(track);

  const sections = [
    section('topics', 'Topics', [
      intro(
        stats.p0 === stats.topics
          ? html`Every topic here is ${priorityBadge('P0')}: it comes up at work every week and in most interviews.`
          : html`${priorityBadge('P0')} topics come up at work every week and in most interviews, so learn them first. ${priorityBadge('P1')} topics are common; learn them next.`,
      ),
      topicTable(track, link, quizzes),
    ]),
    section(
      'plan',
      'Weekly plan',
      track.modules.map((m) => moduleSection(track, m, resources)),
    ),
    section('not-now', 'Not now', [
      intro('Skip these until a job needs them. They take time and rarely come up for junior roles.'),
      html`<ul class="skip-list">\n${track.skip.map(skipItem)}</ul>`,
    ]),
    track.resources &&
      section('resources', 'Resources', [
        intro(
          html`The full list for this track, all free. Each week above links the ones it needs, and the <a href="${link(ROUTES.resources)}">resource finder</a> searches every track's list at once.`,
        ),
        resourceGroups(track.resources, resources, 3),
      ]),
    track.interviewChecklist &&
      section('interview', 'Interview checklist', [
        intro('You are ready when you can do each of these without notes.'),
        textList(track.interviewChecklist, 'done-list'),
      ]),
    track.notes &&
      section(
        'notes',
        'Notes',
        track.notes.map((n) => html`<h3>${n.title}</h3>${textList(n.items)}`),
      ),
    track.capstone && section('capstone', `Capstone: ${track.capstone.title}`, html`<p>${track.capstone.summary}</p>`),
  ];
  const toc: [string, string, unknown][] = [
    ['topics', 'Topics', true],
    ['plan', 'Weekly plan', true],
    ['not-now', 'Not now', true],
    ['resources', 'Resources', track.resources],
    ['interview', 'Interview checklist', track.interviewChecklist],
    ['notes', 'Notes', track.notes],
    ['capstone', 'Capstone', track.capstone],
  ];

  const main = html`<div class="container">
  <nav class="breadcrumb" aria-label="Breadcrumb">
    <ol role="list">
      <li><a href="${link(ROUTES.home)}">Home</a></li>
      <li><a href="${link(ROUTES.tracks)}">Tracks</a></li>
      <li><a href="${link(path)}" aria-current="page">${track.title}</a></li>
    </ol>
  </nav>

  <header class="page-head">
    <p class="eyebrow">Track ${track.order}</p>
    <h1>${track.title}</h1>
    <p class="page-head__lead">${track.summary}</p>
    <dl class="facts">
      <div><dt>Pace</dt><dd>${paceLabel(track)}</dd></div>
      <div><dt>Topics</dt><dd>${stats.topicsLabel}</dd></div>
      <div><dt>Modules</dt><dd>${stats.modules}</dd></div>
      ${track.capstone && html`<div><dt>Capstone</dt><dd>${track.capstone.title}</dd></div>`}
    </dl>
    <p class="notice">${STATUS_NOTE[track.status]}</p>
  </header>

  <nav class="toc" aria-labelledby="toc-title">
    <h2 id="toc-title" class="toc__title">On this page</h2>
    <ul role="list">
${toc.filter(([, , shown]) => shown).map(([id, label]) => html`      <li><a href="#${id}">${label}</a></li>\n`)}    </ul>
  </nav>

  ${sections}

  ${(previous || next) && pager(link, previous, next)}
</div>`;

  return {
    path,
    html: layout({
      link,
      title: `${track.title} track`,
      description: `${track.summary} ${paceLabel(track)}.`,
      current: 'tracks',
      main,
    }),
  };
}
