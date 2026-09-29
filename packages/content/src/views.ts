// Views of the validated content: the shapes the site's pages, the widgets and the API serve.
// The site builds from them, the mock API answers with them, and the Node.js API will too (Phase 4).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  type Content,
  DEFAULT_PASS_MARK,
  hostOf,
  isQuizQuestion,
  isWritten,
  type LessonTask,
  type LessonView,
  type Question,
  type QuizData,
  type QuizQuestion,
  RESOURCE_TYPE_LABELS,
  RESOURCE_TYPE_ORDER,
  type ResourceCatalogue,
  type Topic,
  type TopicRef,
  type TopicSummary,
  type Track,
  type TrackSummary,
  type TrackView,
  type WebResource,
} from '@lp/contracts';
import { lessonTarget, linkTargets, parseInline, parseMarkdown } from '@lp/markdown';
import { DATA_DIR } from './load.ts';

/** For each resource, the ids of the tracks that link to it: from their full lists, their weeks and their topics. */
export function tracksByResource(content: Content): Map<string, string[]> {
  const byResource = new Map<string, string[]>();
  for (const track of content.tracks) {
    const ids = new Set([
      ...(track.resources ?? []),
      ...track.modules.flatMap((m) => m.resources ?? []),
      ...track.topics.flatMap((t) => (t.status === 'outline' ? [] : t.resources.map((r) => r.id))),
    ]);
    for (const id of ids) byResource.set(id, [...(byResource.get(id) ?? []), track.id]);
  }
  return byResource;
}

/** The resource finder's catalogue: every resource, sorted by title. */
export function resourceCatalogue(content: Content): ResourceCatalogue {
  const tracksOf = tracksByResource(content);
  const types = new Set(content.resources.map((r) => r.type));
  return {
    tracks: content.tracks.map(({ id, title }) => ({ id, title })),
    types: RESOURCE_TYPE_ORDER.filter((type) => types.has(type)).map((id) => ({ id, label: RESOURCE_TYPE_LABELS[id] })),
    resources: content.resources
      .map((r) => ({ ...r, host: hostOf(r.url), tracks: tracksOf.get(r.id) ?? [] }))
      .sort((a, b) => a.title.localeCompare(b.title, 'en')),
  };
}

/** A written topic's quiz is its assessment's questions; an outline's is every quiz question about it, in id order. */
function quizQuestions(topic: Topic, questions: readonly Question[]): QuizQuestion[] {
  if (topic.status === 'outline') {
    return questions
      .filter((q): q is QuizQuestion => q.topic === topic.id && isQuizQuestion(q))
      .sort((a, b) => a.id.localeCompare(b.id));
  }
  const byId = new Map(questions.map((q) => [q.id, q]));
  return topic.assessment.questionIds
    .map((id) => byId.get(id))
    .filter((q): q is QuizQuestion => q !== undefined && isQuizQuestion(q));
}

export interface TopicQuiz {
  track: Track;
  topic: Topic;
  quiz: QuizData;
}

/** A quiz for every topic that has quiz questions, in catalogue order. */
export function topicQuizzes(content: Content): TopicQuiz[] {
  return content.tracks.flatMap((track) =>
    track.topics.flatMap((topic) => {
      const questions = quizQuestions(topic, content.questions);
      if (questions.length === 0) return [];
      const passMark = topic.status === 'outline' ? DEFAULT_PASS_MARK : topic.assessment.passMark;
      const quiz: QuizData = {
        track: { id: track.id, title: track.title },
        topic: { id: topic.id, title: topic.title },
        passMark,
        questions,
      };
      return [{ track, topic, quiz }];
    }),
  );
}

/** One topic's quiz, or undefined when it has none. */
export function quizData(content: Content, topicId: string): QuizData | undefined {
  return topicQuizzes(content).find((q) => q.topic.id === topicId)?.quiz;
}

function summarize(topic: Topic, quizSizes: ReadonlyMap<string, number>): TopicSummary {
  const { id, title, priority, module, why, status } = topic;
  return {
    id,
    title,
    priority,
    module,
    why,
    status,
    ...(isWritten(topic) && { estMinutes: topic.estMinutes }),
    quizSize: quizSizes.get(id) ?? 0,
  };
}

function quizSizes(content: Content): Map<string, number> {
  return new Map(topicQuizzes(content).map((q) => [q.topic.id, q.quiz.questions.length]));
}

/** The learning path: every track with its topics, in catalogue order. */
export function trackSummaries(content: Content): TrackSummary[] {
  const sizes = quizSizes(content);
  return content.tracks.map(({ id, order, title, summary, status, pace, topics }) => ({
    id,
    order,
    title,
    summary,
    status,
    pace,
    topics: topics.map((t) => summarize(t, sizes)),
  }));
}

/** One track's whole plan, or undefined when there is no such track. */
export function trackView(content: Content, trackId: string): TrackView | undefined {
  const track = content.tracks.find((t) => t.id === trackId);
  if (!track) return undefined;
  const sizes = quizSizes(content);
  const ids = new Set([...(track.resources ?? []), ...track.modules.flatMap((m) => m.resources ?? [])]);
  const linkedResources: Record<string, WebResource> = {};
  for (const r of content.resources) if (ids.has(r.id)) linkedResources[r.id] = r;
  return { ...track, topics: track.topics.map((t) => summarize(t, sizes)), linkedResources };
}

/** The names of a challenge's test cases, it('…'): lessons list them as what "done" means. */
export function challengeChecks(tests: string): string[] {
  return [...tests.matchAll(/^\s*it\('([^']+)'/gm)].map((match) => match[1] ?? '');
}

function topicRef(content: Content, topicId: string): TopicRef | undefined {
  for (const track of content.tracks) {
    const topic = track.topics.find((t) => t.id === topicId);
    if (topic) return { id: topic.id, title: topic.title, trackId: track.id, written: isWritten(topic) };
  }
  return undefined;
}

/**
 * Everything a written topic's lesson shows, with its theory and challenge files read from `dataDir`.
 * Undefined when there is no such topic or it is still an outline. Throws a MarkdownError for text that
 * breaks the lesson Markdown rules, and an Error for a lesson: link to a topic that is not written.
 */
export function lessonView(content: Content, topicId: string, dataDir: string = DATA_DIR): LessonView | undefined {
  const track = content.tracks.find((t) => t.topics.some((topic) => topic.id === topicId));
  const topic = track?.topics.find((t) => t.id === topicId);
  if (!track || !topic || !isWritten(topic)) return undefined;

  const read = (file: string) => readFileSync(join(dataDir, file), 'utf8').trimEnd();
  const theory = read(topic.theory);
  const challenges = new Map(content.challenges.map((c) => [c.id, c]));
  const tasks = topic.assessment.challengeIds.map((id): LessonTask => {
    const challenge = challenges.get(id);
    if (!challenge) throw new Error(`Unknown challenge "${id}"`);
    const checks = challengeChecks(read(challenge.files.tests));
    if (checks.length === 0) throw new Error(`${challenge.files.tests}: no it('…') test cases found`);
    return { challenge, starter: read(challenge.files.starter), solution: read(challenge.files.solution), checks };
  });

  const resources = topic.resources.map(({ id, note, required }) => {
    const resource = content.resources.find((r) => r.id === id);
    if (!resource) throw new Error(`Unknown resource "${id}"`);
    return { resource, note, required };
  });

  // Parse every Markdown field once: it checks the text, and finds the lessons it links to.
  const where = (field: string) => `${topic.id} ${field}`;
  const nodes = [
    ...parseMarkdown(theory, topic.theory),
    ...topic.objectives.flatMap((o, i) => parseInline(o, where(`objectives[${i}]`))),
    ...topic.examples.flatMap((e) => parseInline(e.takeaway, where(`examples.${e.id}.takeaway`))),
    ...topic.resources.flatMap((r) => parseInline(r.note, where(`resources.${r.id}.note`))),
    ...tasks.flatMap(({ challenge: c }) => [
      ...parseInline(c.prompt, `challenge ${c.id} prompt`),
      ...c.hints.flatMap((hint, i) => parseInline(hint, `challenge ${c.id} hints[${i}]`)),
    ]),
  ];
  const linked = new Set(linkTargets(nodes).flatMap((target) => lessonTarget(target) ?? []));
  const links = [...linked].map((id) => {
    const ref = topicRef(content, id);
    if (!ref?.written) throw new Error(`${topic.theory}: “lesson:${id}” is not a written lesson`);
    return ref;
  });

  const written = track.topics.filter(isWritten);
  const index = written.indexOf(topic);
  const ref = (t: Topic | undefined) => (t ? (topicRef(content, t.id) ?? null) : null);
  const quiz = quizData(content, topic.id);

  return {
    track: { id: track.id, title: track.title },
    module: track.modules.find((m) => m.id === topic.module) ?? null,
    topic,
    theory,
    resources,
    tasks,
    quiz: quiz ? { size: quiz.questions.length, passMark: quiz.passMark } : null,
    prerequisites: topic.prerequisites.map((id) => {
      const prerequisite = topicRef(content, id);
      if (!prerequisite) throw new Error(`Unknown prerequisite "${id}"`);
      return prerequisite;
    }),
    previous: ref(written[index - 1]),
    next: ref(written[index + 1]),
    links,
  };
}
