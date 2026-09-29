import type {
  Challenge,
  CodeExample,
  Level,
  Topic,
  TopicOutline,
  TopicResource,
  Track,
  WebResource,
} from '@lp/contracts';
import { html, join, type SafeHtml } from '../html.ts';
import { layout, type Page } from '../layout.ts';
import { type LinkResolver, MarkdownError, renderInline, renderMarkdown } from '../markdown.ts';
import { linkFrom, ROUTES } from '../routes.ts';
import { hostOf, moduleAnchor, priorityBadge, section, TYPE_LABELS, weeksLabel } from './parts.ts';
import { topicAnchor } from './track.ts';

/** A topic with the five-part template filled in: a draft or a published lesson. */
export type WrittenTopic = Exclude<Topic, TopicOutline>;

export const isWritten = (topic: Topic): topic is WrittenTopic => topic.status !== 'outline';

/** A coding task, with the files the page shows. */
export interface LessonTask {
  challenge: Challenge;
  starter: string;
  solution: string;
  /** What the challenge's tests check: the names of its test cases. */
  checks: string[];
}

export interface LessonPageInput {
  track: Track;
  topic: WrittenTopic;
  /** The theory's Markdown source. */
  theory: string;
  tasks: LessonTask[];
  resources: ReadonlyMap<string, WebResource>;
  /** How many questions the topic's quiz has; 0 when it has none. */
  quizSize: number;
  /** Every topic by id, with its track, for prerequisites and links between lessons. */
  topics: ReadonlyMap<string, { track: Track; topic: Topic }>;
  previous?: WrittenTopic | undefined;
  next?: WrittenTopic | undefined;
}

const LEVEL_LABELS: Record<Level, string> = { foundation: 'Foundation', core: 'Core', advanced: 'Advanced' };

/** Ids the page itself uses, which a heading in the theory must not make again. */
const PAGE_IDS = new Set(['goals', 'toc-title', 'examples', 'resources', 'check'].flatMap((id) => [id, `${id}-title`]));

function exampleBlock(example: CodeExample, md: (text: string, where: string) => SafeHtml): SafeHtml {
  const id = `example-${example.id}`;
  return html`<section class="example" aria-labelledby="${id}">
      <h3 id="${id}">${example.title}</h3>
      <pre class="code"><code>${example.code}</code></pre>
      <p class="example__takeaway"><strong>Notice:</strong> ${md(example.takeaway, `examples.${example.id}.takeaway`)}</p>
    </section>
`;
}

function resourceItem(r: TopicResource, resources: ReadonlyMap<string, WebResource>, note: SafeHtml): SafeHtml {
  const web = resources.get(r.id);
  if (!web) throw new Error(`Unknown resource "${r.id}"`);
  return html`<li><a href="${web.url}">${web.title}</a> <span class="resource-list__meta">${TYPE_LABELS[web.type]} · ${hostOf(web.url)}</span><span class="resource-list__note">${note}</span></li>\n`;
}

function codeTask({ challenge, starter, solution, checks }: LessonTask, md: (text: string, where: string) => SafeHtml) {
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

export function lessonPage(input: LessonPageInput): Page {
  const { track, topic, resources, quizSize, previous, next } = input;
  const path = ROUTES.lesson(topic.id);
  const link = linkFrom(path);

  // Lesson text may link to the web, or to another written lesson as "lesson:<topic-id>".
  const resolveLink: LinkResolver = (target) => {
    if (target.startsWith('https://')) return target;
    const id = /^lesson:([a-z0-9-]+)$/.exec(target)?.[1];
    const found = id === undefined ? undefined : input.topics.get(id)?.topic;
    return found && isWritten(found) ? link(ROUTES.lesson(found.id)) : undefined;
  };
  const md = (text: string, where: string) => renderInline(text, { name: `${topic.id} ${where}`, resolveLink });
  const theory = renderMarkdown(input.theory, { name: topic.theory, resolveLink });
  const clash = theory.headings.find((h) => PAGE_IDS.has(h.id) || h.id.startsWith('example-'));
  if (clash) {
    throw new MarkdownError(`${topic.theory}: the heading id "${clash.id}" is already used by the lesson page`);
  }

  const module = track.modules.find((m) => m.id === topic.module);
  const moduleLink =
    module &&
    html`<a href="${link(`${ROUTES.track(track.id)}#${moduleAnchor(module)}`)}">${[weeksLabel(module), module.title].filter(Boolean).join(': ')}</a>`;
  const prerequisites = topic.prerequisites.map((id) => {
    const found = input.topics.get(id);
    if (!found) throw new Error(`Unknown prerequisite "${id}"`);
    const href = isWritten(found.topic)
      ? ROUTES.lesson(id)
      : `${ROUTES.track(found.track.id)}#${topicAnchor(found.topic)}`;
    return html`<a href="${link(href)}">${found.topic.title}</a>`;
  });

  const required = topic.resources.filter((r) => r.required);
  const optional = topic.resources.filter((r) => !r.required);
  const resourceGroup = (title: string, items: TopicResource[]) =>
    items.length > 0 &&
    html`<div><h3>${title}</h3><ul class="resource-list" role="list">
${items.map((r) => resourceItem(r, resources, md(r.note, `resources.${r.id}.note`)))}</ul></div>\n`;

  const quiz =
    quizSize > 0 &&
    html`<div class="task">
      <h3>Quiz</h3>
      <p>${quizSize} questions, each with an explanation. Get ${Math.round(topic.assessment.passMark * 100)}% right to complete the lesson.</p>
      <p><a class="button" href="${link(ROUTES.quiz(topic.id))}">Take the quiz</a></p>
    </div>`;

  const toc: [string, SafeHtml | string][] = [
    ...theory.headings.filter((h) => h.level === 2).map((h): [string, SafeHtml] => [h.id, h.html]),
    ['examples', 'Code examples'],
    ['resources', 'Resources'],
    ['check', 'Check yourself'],
  ];

  const pager =
    (previous || next) &&
    html`<nav class="pager" aria-label="Lessons">
    ${previous && html`<a class="pager__link" rel="prev" href="${link(ROUTES.lesson(previous.id))}"><span aria-hidden="true">←</span> ${previous.title}</a>`}
    ${next && html`<a class="pager__link pager__link--next" rel="next" href="${link(ROUTES.lesson(next.id))}">${next.title} <span aria-hidden="true">→</span></a>`}
  </nav>`;

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
    ${input.tasks.map((task) => codeTask(task, md))}
  </div>`,
  )}

  ${pager}
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
