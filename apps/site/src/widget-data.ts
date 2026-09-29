// The JSON the widgets fetch, made from the validated content at build time.
import {
  type Content,
  DEFAULT_PASS_MARK,
  isQuizQuestion,
  type Question,
  type QuizData,
  type QuizQuestion,
  type ResourceCatalogue,
  type Topic,
  type Track,
} from '@lp/contracts';
import { hostOf, TYPE_LABELS, TYPE_ORDER } from './pages/parts.ts';

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

/** data/resources.json, for the resource finder: every resource, sorted by title. */
export function resourceCatalogue(content: Content): ResourceCatalogue {
  const tracksOf = tracksByResource(content);
  const types = new Set(content.resources.map((r) => r.type));
  return {
    tracks: content.tracks.map(({ id, title }) => ({ id, title })),
    types: TYPE_ORDER.filter((type) => types.has(type)).map((id) => ({ id, label: TYPE_LABELS[id] })),
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
  /** data/quizzes/<topic-id>.json */
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
