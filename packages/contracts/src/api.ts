import { z } from 'zod';
import type { Challenge, Id, Module, Priority, Topic, Track, WebResource, WrittenTopic } from './content.ts';
import { Id as IdSchema } from './content.ts';

// The HTTP API the learning app reads. The Node.js API (apps/api) answers it from PostgreSQL; the mock in
// apps/shell/mock-api answers the same paths and shapes from memory, for tests and for working without a database.

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
  /** GET: Progress, for the signed-in learner (401 when nobody is signed in). */
  progress: '/api/progress',
  /** PUT a ProgressUpdate: marks a topic done for the signed-in learner and answers with its TopicProgress. */
  topicProgress: (topicId: string) => `/api/progress/${topicId}`,
  /** GET: Me. */
  me: '/api/me',
  /** POST a SignUp: creates the account, signs it in (a session cookie) and answers 201 with Me. */
  signUp: '/api/auth/sign-up',
  /** POST a SignIn: answers with Me and a session cookie, or 401. */
  signIn: '/api/auth/sign-in',
  /** POST {}: ends the session and answers 204. */
  signOut: '/api/auth/sign-out',
  /** GET: { ok: true } when the API can reach its database, else 503. For load balancers and uptime checks. */
  health: '/api/health',
} as const;

/** Where the learning app lives on the platform's domain; the site has the root, the API has /api. */
export const APP_BASE = '/app/';

/**
 * Every error answer: { "error": "No track called react-native" }. A body that fails its schema also names
 * each field's first problem: { "error": "…", "fields": { "email": "Enter an email address like name@example.com" } }.
 */
export interface ApiError {
  error: string;
  fields?: Record<string, string>;
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

/** GET /api/progress: the signed-in learner's finished topics, oldest first. */
export interface Progress {
  completed: TopicProgress[];
}

/** The body of PUT /api/progress/:topicId, checked at the API's edge. */
export const ProgressUpdate = z.strictObject({
  trackId: IdSchema,
  score: z.number().min(0).max(1),
});
export type ProgressUpdate = z.infer<typeof ProgressUpdate>;
