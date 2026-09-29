import type { Question, ResourceType, WebResource } from './content.ts';

// The JSON the site build writes for the Phase 2 widgets, and the shapes the widgets read with JSDoc.
// Plain types rather than schemas: the build writes them from content that has already passed `Content`.

/** One resource in the finder's catalogue: the web resource plus what the filters need. */
export interface CatalogueResource extends WebResource {
  /** The site the link goes to, without "www.": "developer.mozilla.org". */
  host: string;
  /** Ids of the tracks that link to it, in catalogue order. */
  tracks: string[];
}

/** data/resources.json: every web resource, for the resource finder. */
export interface ResourceCatalogue {
  tracks: { id: string; title: string }[];
  types: { id: ResourceType; label: string }[];
  resources: CatalogueResource[];
}

/** The question types a quiz can score on its own; the others need a person or a code runner. */
export const QUIZ_TYPES = ['mcq', 'multi_select', 'predict_output'] as const;

export type QuizQuestion = Extract<Question, { type: (typeof QUIZ_TYPES)[number] }>;

export function isQuizQuestion(q: Question): q is QuizQuestion {
  return q.usage.includes('quiz') && (QUIZ_TYPES as readonly string[]).includes(q.type);
}

/** The pass mark for topics that have questions but no written assessment yet. */
export const DEFAULT_PASS_MARK = 0.8;

/** data/quizzes/<topic-id>.json: one topic's quiz. */
export interface QuizData {
  track: { id: string; title: string };
  topic: { id: string; title: string };
  /** Share of questions to get right to pass, from 0 to 1. */
  passMark: number;
  questions: QuizQuestion[];
}
