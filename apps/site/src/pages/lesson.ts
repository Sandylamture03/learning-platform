import {
  type CodeExample,
  hostOf,
  type LessonTask,
  type LessonView,
  type Level,
  RESOURCE_TYPE_LABELS,
  type TopicRef,
} from '@lp/contracts';
import { html, join, type SafeHtml } from '../html.ts';
import { layout, type Page } from '../layout.ts';
import { MarkdownError, renderInline, renderMarkdown } from '../markdown.ts';
import { type Link, linkFrom, ROUTES } from '../routes.ts';
import { moduleAnchor, priorityBadge, section, weeksLabel } from './parts.ts';
import { topicAnchor } from './track.ts';

const LEVEL_LABELS: Record<Level, string> = { foundation: 'Foundation', core: 'Core', advanced: 'Advanced' };

/** Ids the page itself uses, which a heading in the theory must not make again. */
const PAGE_IDS = new Set(['goals', 'toc-title', 'examples', 'resources', 'check'].flatMap((id) => [id, `${id}-title`]));

type Md = (text: string, where: string) => SafeHtml;

/** A written topic links to its lesson; an outline to its row on the track page. */
function topicHref(ref: TopicRef): string {
  return ref.written ? ROUTES.lesson(ref.id) : `${ROUTES.track(ref.trackId)}#${topicAnchor(ref)}`;
}

function exampleBlock(example: CodeExample, md: Md): SafeHtml {
  const id = `example-${example.id}`;
  return html`<section class="example" aria-labelledby="${id}">
      <h3 id="${id}">${example.title}</h3>
      <pre class="code"><code>${example.code}</code></pre>
      <p class="example__takeaway"><strong>Notice:</strong> ${md(example.takeaway, `examples.${example.id}.takeaway`)}</p>
    </section>
`;
}

function resourceItem({ resource, note }: LessonView['resources'][number], md: Md): SafeHtml {
  const meta = `${RESOURCE_TYPE_LABELS[resource.type]} · ${hostOf(resource.url)}`;
  return html`<li><a href="${resource.url}">${resource.title}</a> <span class="resource-list__meta">${meta}</span><span class="resource-list__note">${md(note, `resources.${resource.id}.note`)}</span></li>\n`;
}

function codeTask({ challenge, starter, solution, checks }: LessonTask, md: Md) {
  const where = (field: string) => `challenge ${challenge.id} ${field}`;
  const hints = challenge.hints.map(
    (hint, i) => html`<details><summary>Hint ${i + 1}</summary><p>${md(hint, where(`hints[${i}]`))}</p></details>\n`,
  );
  return html`<div class="task">
      <h3>Coding task: ${challenge.title}</h3>
      <p class="task__meta">About ${challenge.estMinutes} minutes</p>
      <p>${md(challenge.prompt, where('prompt'))}</p>
      <h4>Start from this</h4>
      <pre class="code"><code>${starter}</code></pre>
      <h4>Done when it</h4>
      <ul class="done-list">
${checks.map((check) => html`<li>${check}</li>\n`)}      </ul>
      <p class="task__note">Write it in your own editor for now; checking your code for you comes with the learning app.</p>
      ${hints}<details><summary>Show a solution</summary><pre class="code"><code>${solution}</code></pre></details>
    </div>`;
}

function pager(link: Link, previous: TopicRef | null, next: TopicRef | null): SafeHtml | false {
  return (
    (previous !== null || next !== null) &&
    html`<nav class="pager" aria-label="Lessons">
    ${previous && html`<a class="pager__link" rel="prev" href="${link(ROUTES.lesson(previous.id))}"><span aria-hidden="true">←</span> ${previous.title}</a>`}
    ${next && html`<a class="pager__link pager__link--next" rel="next" href="${link(ROUTES.lesson(next.id))}">${next.title} <span aria-hidden="true">→</span></a>`}
  </nav>`
  );
}

export function lessonPage(view: LessonView): Page {
  const { track, module, topic } = view;
  const path = ROUTES.lesson(topic.id);
  const link = linkFrom(path);

  // Lesson text may link to another written lesson as lesson:<topic-id>; the view lists them.
  const lessonHref = (id: string) => {
    const target = view.links.find((ref) => ref.id === id);
    return target && link(ROUTES.lesson(target.id));
  };
  const md: Md = (text, where) => renderInline(text, { name: `${topic.id} ${where}`, lessonHref });
  const theory = renderMarkdown(view.theory, { name: topic.theory, lessonHref });
  const clash = theory.headings.find((h) => PAGE_IDS.has(h.id) || h.id.startsWith('example-'));
  if (clash) {
    throw new MarkdownError(`${topic.theory}: the heading id "${clash.id}" is already used by the lesson page`);
  }

  const moduleLink =
    module &&
    html`<a href="${link(`${ROUTES.track(track.id)}#${moduleAnchor(module)}`)}">${[weeksLabel(module), module.title].filter(Boolean).join(': ')}</a>`;
  const prerequisites = view.prerequisites.map((ref) => html`<a href="${link(topicHref(ref))}">${ref.title}</a>`);

  const required = view.resources.filter((r) => r.required);
  const optional = view.resources.filter((r) => !r.required);
  const resourceGroup = (title: string, items: LessonView['resources']) =>
    items.length > 0 &&
    html`<div><h3>${title}</h3><ul class="resource-list" role="list">
${items.map((r) => resourceItem(r, md))}</ul></div>\n`;

  const quiz =
    view.quiz &&
    html`<div class="task">
      <h3>Quiz</h3>
      <p>${view.quiz.size} questions, each with an explanation. Get ${Math.round(view.quiz.passMark * 100)}% right to complete the lesson.</p>
      <p><a class="button" href="${link(ROUTES.quiz(topic.id))}">Take the quiz</a></p>
    </div>`;

  const toc: [string, SafeHtml | string][] = [
    ...theory.headings.filter((h) => h.level === 2).map((h): [string, SafeHtml] => [h.id, h.html]),
    ['examples', 'Code examples'],
    ['resources', 'Resources'],
    ['check', 'Check yourself'],
  ];

  const main = html`<div class="container">
  <nav class="breadcrumb" aria-label="Breadcrumb">
    <ol role="list">
      <li><a href="${link(ROUTES.home)}">Home</a></li>
      <li><a href="${link(ROUTES.tracks)}">Tracks</a></li>
      <li><a href="${link(ROUTES.track(track.id))}">${track.title}</a></li>
      <li><a href="${link(path)}" aria-current="page">${topic.title}</a></li>
    </ol>
  </nav>

  <header class="page-head">
    <p class="eyebrow">${track.title} lesson</p>
    <h1>${topic.title}</h1>
    <p class="page-head__lead">${topic.summary}</p>
    <dl class="facts">
      <div><dt>Priority</dt><dd>${priorityBadge(topic.priority)}</dd></div>
      <div><dt>Level</dt><dd>${LEVEL_LABELS[topic.level]}</dd></div>
      <div><dt>Time</dt><dd>About ${topic.estMinutes} minutes</dd></div>
      ${moduleLink && html`<div><dt>Week</dt><dd>${moduleLink}</dd></div>`}
      ${prerequisites.length > 0 && html`<div><dt>Read first</dt><dd>${join(prerequisites, ', ')}</dd></div>`}
    </dl>
    ${topic.status === 'draft' && html`<p class="notice">This lesson is a draft: every part is here, but some may still change.</p>`}
  </header>

  ${section(
    'goals',
    'What you will learn',
    html`<ul class="done-list">
${topic.objectives.map((o, i) => html`<li>${md(o, `objectives[${i}]`)}</li>\n`)}</ul>`,
  )}

  <nav class="toc" aria-labelledby="toc-title">
    <h2 id="toc-title" class="toc__title">On this page</h2>
    <ul role="list">
${toc.map(([id, label]) => html`      <li><a href="#${id}">${label}</a></li>\n`)}    </ul>
  </nav>

  <div class="prose">
${theory.html}  </div>

  ${section(
    'examples',
    'Code examples',
    topic.examples.map((e) => exampleBlock(e, md)),
  )}

  ${section('resources', 'Resources', [
    html`<p class="section__intro">${required.length > 0 && optional.length > 0 ? 'All free. Start here, then go further when you want more.' : 'All free.'}</p>`,
    html`<div class="resource-groups">
${resourceGroup('Start here', required)}${resourceGroup('Go further', optional)}</div>`,
  ])}

  ${section(
    'check',
    'Check yourself',
    html`<div class="tasks">
    ${quiz}
    ${view.tasks.map((task) => codeTask(task, md))}
  </div>`,
  )}

  ${pager(link, view.previous, view.next)}
</div>`;

  return {
    path,
    html: layout({
      link,
      title: `${track.title}: ${topic.title}`,
      description: topic.summary,
      current: 'tracks',
      main,
    }),
  };
}
