import { z } from 'zod';
import type { Challenge, Id, Module, Priority, Topic, Track, WebResource, WrittenTopic } from './content.ts';
import { Id as IdSchema } from './content.ts';

// The HTTP API the learning app reads. Phase 3 answers it with a mock (apps/shell/mock-api) that serves the
// content as it is; the Node.js API takes over in Phase 4 with the same paths and shapes.

export const API = {
  /** GET: TrackSummary[], in catalogue order. */
  tracks: '/api/tracks',
  /** GET: TrackView. */
  track: (trackId: string) => `/api/tracks/${trackId}`,
  /** GET: LessonView, for a written topic. */
  lesson: (topicId: string) => `/api/lessons/${topicId}`,
  /** GET: QuizData, what the quiz widget loads. */
  quiz: (topicId: string) => `/api/quizzes/${topicId}`,
  /** GET: ResourceCatalogue, what the resource finder loads. */
  resources: '/api/resources',
  /** GET: Progress. */
  progress: '/api/progress',
  /** PUT a ProgressUpdate: marks a topic done and answers with its TopicProgress. */
  topicProgress: (topicId: string) => `/api/progress/${topicId}`,
} as const;

/** Every error answer: { "error": "No track called react-native" }. */
export interface ApiError {
  error: string;
}

/** A topic as lists show it. */
export interface TopicSummary {
  id: Id;
  title: string;
  priority: Priority;
  module: Id;
  why: string;
  status: Topic['status'];
  /** How long the lesson takes; only written topics have one. */
  estMinutes?: number;
  /** How many quiz questions the topic has; 0 when it has no quiz. */
  quizSize: number;
}

/** GET /api/tracks: one entry per track, with its topics, for the learning path. */
export interface TrackSummary extends Pick<Track, 'id' | 'order' | 'title' | 'summary' | 'status' | 'pace'> {
  topics: TopicSummary[];
}

/** GET /api/tracks/:trackId: the whole plan, with topic summaries and the resources its weeks link to. */
export interface TrackView extends Omit<Track, 'topics'> {
  topics: TopicSummary[];
  /** Every web resource the track's weeks and resource list mention, by id. */
  linkedResources: Record<Id, WebResource>;
}

/** Another topic, as a link needs it. */
export interface TopicRef {
  id: Id;
  title: string;
  trackId: Id;
  /** Whether it has a lesson to link to; outlines are linked on their track instead. */
  written: boolean;
}

/** A coding task with its files: the starter and solution code, and what its tests check. */
export interface LessonTask {
  challenge: Challenge;
  starter: string;
  solution: string;
  /** The names of the tests, which finish the sentence "Done when it…". */
  checks: string[];
}

/** GET /api/lessons/:topicId: everything a lesson page shows. Text fields hold lesson Markdown (@lp/markdown). */
export interface LessonView {
  track: { id: Id; title: string };
  module: Module | null;
  topic: WrittenTopic;
  /** The theory, as Markdown. */
  theory: string;
  resources: { resource: WebResource; note: string; required: boolean }[];
  tasks: LessonTask[];
  /** The topic's quiz, loaded separately from API.quiz; null when it has none. */
  quiz: { size: number; passMark: number } | null;
  prerequisites: TopicRef[];
  /** The written lessons before and after this one in its track. */
  previous: TopicRef | null;
  next: TopicRef | null;
  /** The lessons the text links to with lesson:<topic-id>. */
  links: TopicRef[];
}

/** One finished topic. */
export interface TopicProgress {
  topicId: Id;
  trackId: Id;
  /** The quiz score that finished it, from 0 to 1. */
  score: number;
  /** An ISO timestamp. */
  completedAt: string;
}

/** GET /api/progress: the learner's finished topics, oldest first. Accounts arrive in Phase 4. */
export interface Progress {
  completed: TopicProgress[];
}

/** The body of PUT /api/progress/:topicId, checked at the API's edge. */
export const ProgressUpdate = z.strictObject({
  trackId: IdSchema,
  score: z.number().min(0).max(1),
});
export type ProgressUpdate = z.infer<typeof ProgressUpdate>;
