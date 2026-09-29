import { z } from 'zod';

// ---------------------------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------------------------

/** kebab-case ids: lowercase letters and digits, joined by single hyphens ("box-model", "week-3"). */
export const Id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use a kebab-case id such as "box-model"');

/** Non-empty text without stray spaces at either end. */
export const Text = z
  .string()
  .min(1, 'Must not be empty')
  .refine((s) => s === s.trim(), 'Remove the spaces at the start or end');

/** "<topic-id>.q01": questions are numbered within their topic. */
export const QuestionId = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*\.q\d{2,}$/, 'Use "<topic-id>.q01", for example "flexbox.q01"');

export const Technology = z.enum(['html5', 'css3', 'javascript', 'typescript', 'react', 'nodejs']);

/** P0: asked in most interviews and used every week. P1: common. P2: good to know. */
export const Priority = z.enum(['P0', 'P1', 'P2']);

export const Level = z.enum(['foundation', 'core', 'advanced']);
const Difficulty = z.int().min(1).max(3);

// ---------------------------------------------------------------------------------------------
// Resources and the local library
// ---------------------------------------------------------------------------------------------

export const ResourceType = z.enum([
  'docs',
  'article',
  'video',
  'course',
  'interactive',
  'cheatsheet',
  'tool',
  'reference',
]);

/** How each resource type is named on screen. */
export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  docs: 'Docs',
  article: 'Article',
  video: 'Video',
  course: 'Course',
  interactive: 'Practice',
  cheatsheet: 'Cheat sheet',
  tool: 'Tool',
  reference: 'Reference',
};

/** Order of resource types in grouped lists and filters: structured learning first. */
export const RESOURCE_TYPE_ORDER: readonly ResourceType[] = [
  'course',
  'docs',
  'interactive',
  'video',
  'article',
  'cheatsheet',
  'tool',
  'reference',
];

/** "developer.mozilla.org": the site a link goes to, without "www.". */
export function hostOf(url: string): string {
  return new URL(url).hostname.replace(/^www\./, '');
}

/** A link to a free page on the web. The platform links out and never copies third-party text. */
export const WebResource = z.strictObject({
  id: Id,
  title: Text,
  url: z.url({ protocol: /^https$/, error: 'Use a full https:// URL' }),
  type: ResourceType,
});

export const Verdict = z.enum([
  'primary',
  'elective',
  'reference',
  'ideas',
  'notes',
  'check-first',
  'dated',
  'off-topic',
]);

/** A file in your own study folders, with the verdict from the build plan's inventory. */
export const LibraryItem = z.strictObject({
  id: Id,
  title: Text,
  files: z.array(Text).min(1),
  folder: Text,
  kind: z.enum(['roadmap', 'ebook', 'notes', 'cheatsheet', 'checklist', 'question-bank', 'spreadsheet', 'other']),
  summary: Text,
  verdict: Verdict,
  usedIn: Text,
  tracks: z.array(Id).min(1).optional(),
});

// ---------------------------------------------------------------------------------------------
// Tracks: modules (weeks) and topics
// ---------------------------------------------------------------------------------------------

export const SkipItem = z.strictObject({
  item: Text,
  why: Text.optional(),
  instead: Text.optional(),
});

/** The week's Practice Lab brief. */
export const Build = z
  .strictObject({
    title: Text,
    brief: Text.optional(),
    checklist: z.array(Text).min(1).optional(),
  })
  .refine((b) => b.brief !== undefined || b.checklist !== undefined, 'A build needs a brief, a checklist or both');

const WeekRange = z
  .tuple([z.int().positive(), z.int().positive()])
  .refine(([first, last]) => first <= last, 'The first week must not come after the last');

export const Module = z.strictObject({
  id: Id,
  title: Text,
  weeks: WeekRange.optional(),
  goal: Text.optional(),
  learn: z.array(Text).min(1).optional(),
  build: Build.optional(),
  /** The module's assessment: when every line is true, move on. */
  doneWhen: z.array(Text).min(1).optional(),
  resources: z.array(Id).min(1).optional(),
  /** Things to skip for now, so they don't eat the week. */
  notNow: z.array(Text).min(1).optional(),
  source: Text.optional(),
});

const topicCore = {
  id: Id,
  title: Text,
  priority: Priority,
  /** The id of the module (week) that teaches it. */
  module: Id,
  /** One or two sentences on why the topic is in the 20%. */
  why: Text,
};

/** Imported from a guide: enough to plan with, not yet written. */
export const TopicOutline = z.strictObject({ ...topicCore, status: z.literal('outline') });

export const CodeExample = z.strictObject({
  id: Id,
  title: Text,
  language: z.enum(['html', 'css', 'js', 'jsx', 'ts', 'tsx', 'json', 'shell', 'sql', 'http']),
  code: Text,
  /** The one thing to notice. */
  takeaway: Text,
});

export const TopicResource = z.strictObject({
  id: Id,
  /** Why this link, for this topic. */
  note: Text,
  required: z.boolean(),
});

const Assessment = z.strictObject({
  /** Share of questions to get right to complete the topic, from 0 to 1. */
  passMark: z.number().min(0).max(1),
  questionIds: z.array(QuestionId),
  challengeIds: z.array(Id),
});

// The five-part topic template: 1 header, 2 theory, 3 code examples, 4 resources, 5 assessment.
const writtenTopic = {
  ...topicCore,
  // 1. Header
  summary: Text,
  level: Level,
  difficulty: Difficulty,
  estMinutes: z.int().positive(),
  prerequisites: z.array(Id),
  objectives: z.array(Text).min(1).max(5),
  // 2. Theory, in Markdown, stored at data/theory/<track-id>/<topic-id>.md
  theory: z.string().regex(/^theory\/[a-z0-9-]+\/[a-z0-9-]+\.md$/, 'Use "theory/<track-id>/<topic-id>.md"'),
  // 3. Code examples
  examples: z.array(CodeExample),
  // 4. Resources
  resources: z.array(TopicResource),
  // 5. Assessment
  assessment: Assessment,
  version: z.int().positive(),
  updatedAt: z.iso.date(),
};

/** Being written: every part exists, the counts are not enforced yet. */
export const DraftTopic = z.strictObject({ ...writtenTopic, status: z.literal('draft') });

/** Ready for learners: the template's counts are enforced. */
export const PublishedTopic = z.strictObject({
  ...writtenTopic,
  status: z.literal('published'),
  objectives: z.array(Text).length(3, 'A published topic has exactly three learning objectives'),
  examples: z.array(CodeExample).min(2, 'A published topic has two to four examples').max(4),
  resources: z.array(TopicResource).min(3, 'A published topic links three to five resources').max(5),
  assessment: Assessment.extend({
    questionIds: z.array(QuestionId).min(4, 'A published topic has four to six questions').max(6),
    challengeIds: z.array(Id).min(1, 'A published topic has a coding task'),
  }),
});

export const Topic = z.discriminatedUnion('status', [TopicOutline, DraftTopic, PublishedTopic]);

export const Track = z.strictObject({
  id: Id,
  /** Position in the catalogue; the order most learners take the tracks in. */
  order: z.int().positive(),
  title: Text,
  technologies: z.array(Technology).min(1),
  status: z.enum(['outline', 'draft', 'published']),
  summary: Text,
  pace: z.strictObject({ weeks: z.int().positive(), effort: Text }),
  /** The guides the track was built from. */
  sources: z.array(Text).min(1),
  skip: z.array(SkipItem),
  modules: z.array(Module).min(1),
  topics: z.array(Topic).min(1),
  /** The guide's master resource list. */
  resources: z.array(Id).min(1).optional(),
  interviewChecklist: z.array(Text).min(1).optional(),
  notes: z.array(z.strictObject({ title: Text, items: z.array(Text).min(1) })).optional(),
  capstone: z.strictObject({ title: Text, summary: Text }).optional(),
});

// ---------------------------------------------------------------------------------------------
// Interview Vault and Practice Lab (written in Phase 5; the shapes are fixed now)
// ---------------------------------------------------------------------------------------------

const RubricPoint = z.strictObject({ id: Id, point: Text, weight: z.int().min(1).max(3) });
const Option = z.strictObject({ id: Id, text: Text });

const questionBase = {
  id: QuestionId,
  topic: Id,
  difficulty: Difficulty,
  priority: Priority,
  usage: z.array(z.enum(['quiz', 'interview', 'review'])).min(1),
  tags: z.array(Id),
  prompt: Text,
};

export const Question = z.discriminatedUnion('type', [
  z
    .strictObject({
      ...questionBase,
      type: z.literal('mcq'),
      options: z.array(Option).min(2),
      answer: Id,
      explanation: Text,
    })
    .refine((q) => q.options.some((o) => o.id === q.answer), {
      message: 'The answer must be one of the option ids',
      path: ['answer'],
    }),
  z
    .strictObject({
      ...questionBase,
      type: z.literal('multi_select'),
      options: z.array(Option).min(2),
      answers: z.array(Id).min(1),
      explanation: Text,
    })
    .refine((q) => q.answers.every((a) => q.options.some((o) => o.id === a)), {
      message: 'Every answer must be one of the option ids',
      path: ['answers'],
    }),
  z.strictObject({
    ...questionBase,
    type: z.literal('predict_output'),
    code: Text,
    answer: Text,
    explanation: Text,
  }),
  z.strictObject({
    ...questionBase,
    type: z.literal('deep_dive'),
    timeLimitSec: z.int().positive(),
    followUps: z.array(Text),
    modelAnswer: Text,
    rubric: z.array(RubricPoint).min(2),
  }),
  z.strictObject({
    ...questionBase,
    type: z.literal('coding'),
    challenge: Id,
    timeLimitSec: z.int().positive(),
    followUps: z.array(Text),
    rubric: z.array(RubricPoint).min(1),
  }),
]);

export const Challenge = z.strictObject({
  id: Id,
  title: Text,
  kind: z.enum(['function', 'hook', 'component', 'page', 'endpoint']),
  mode: z.enum(['build', 'debug']),
  difficulty: Difficulty,
  priority: Priority,
  topics: z.array(Id).min(1),
  estMinutes: z.int().positive(),
  prompt: Text,
  files: z.strictObject({ starter: Text, solution: Text, tests: Text }),
  hints: z.array(Text).length(3, 'Give exactly three hints, from a nudge to nearly the answer'),
  status: z.enum(['draft', 'published']),
  version: z.int().positive(),
});

// ---------------------------------------------------------------------------------------------
// All content, with the cross-file checks a single schema can't express
// ---------------------------------------------------------------------------------------------

type Ctx = z.RefinementCtx;
type Path = (string | number)[];

/** Adds an issue for every repeated key, at [...list, index, field]. */
function flagDuplicates(ctx: Ctx, keys: readonly string[], list: Path, field: string, what: string) {
  const first = new Map<string, number>();
  keys.forEach((key, i) => {
    const seen = first.get(key);
    if (seen === undefined) first.set(key, i);
    else
      ctx.addIssue({
        code: 'custom',
        path: [...list, i, field],
        message: `Duplicate ${what} "${key}" (also at index ${seen})`,
      });
  });
}

/** Host without "www." plus the path without a trailing slash: two URLs for one page compare equal. */
function pageKey(url: string): string {
  const u = new URL(url);
  return `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/$/, '')}${u.search}`;
}

function checkReferences(c: ContentInput, ctx: Ctx) {
  const issue = (path: Path, message: string) => ctx.addIssue({ code: 'custom', path, message });

  const ids = (items: readonly { id: string }[]) => items.map((item) => item.id);
  const orders = c.tracks.map((t) => String(t.order));
  const pages = c.resources.map((r) => pageKey(r.url));
  flagDuplicates(ctx, ids(c.tracks), ['tracks'], 'id', 'track id');
  flagDuplicates(ctx, orders, ['tracks'], 'order', 'track order');
  flagDuplicates(ctx, ids(c.resources), ['resources'], 'id', 'resource id');
  flagDuplicates(ctx, pages, ['resources'], 'url', 'resource URL');
  flagDuplicates(ctx, ids(c.library), ['library'], 'id', 'library id');
  flagDuplicates(ctx, ids(c.questions), ['questions'], 'id', 'question id');
  flagDuplicates(ctx, ids(c.challenges), ['challenges'], 'id', 'challenge id');

  const trackIds = new Set(c.tracks.map((t) => t.id));
  const resourceIds = new Set(c.resources.map((r) => r.id));
  const questions = new Map(c.questions.map((q) => [q.id, q]));
  const challenges = new Map(c.challenges.map((ch) => [ch.id, ch]));
  const topicIds = new Set<string>();
  const topicHome = new Map<string, string>();

  const knownResources = (ids: readonly string[] | undefined, path: Path) => {
    ids?.forEach((id, i) => {
      if (!resourceIds.has(id)) issue([...path, i], `Unknown resource "${id}": add it to resources.json first`);
    });
  };

  c.tracks.forEach((track, ti) => {
    const at = (...rest: Path): Path => ['tracks', ti, ...rest];
    flagDuplicates(ctx, ids(track.modules), at('modules'), 'id', 'module id');
    knownResources(track.resources, at('resources'));
    const moduleIds = new Set(track.modules.map((m) => m.id));

    track.modules.forEach((m, mi) => {
      knownResources(m.resources, at('modules', mi, 'resources'));
      if (m.weeks && m.weeks[1] > track.pace.weeks) {
        issue(at('modules', mi, 'weeks'), `Week ${m.weeks[1]} is past the track's ${track.pace.weeks}-week pace`);
      }
    });

    track.topics.forEach((topic, i) => {
      const home = topicHome.get(topic.id);
      if (home) issue(at('topics', i, 'id'), `Duplicate topic id "${topic.id}" (also in track "${home}")`);
      topicHome.set(topic.id, track.id);
      topicIds.add(topic.id);
      if (!moduleIds.has(topic.module)) {
        issue(at('topics', i, 'module'), `Unknown module "${topic.module}" in track "${track.id}"`);
      }
    });
  });

  // Written topics point at theory files, resources, questions, challenges and other topics.
  c.tracks.forEach((track, ti) => {
    track.topics.forEach((topic, i) => {
      if (topic.status === 'outline') return;
      const at = (...rest: Path): Path => ['tracks', ti, 'topics', i, ...rest];
      const expected = `theory/${track.id}/${topic.id}.md`;
      if (topic.theory !== expected) issue(at('theory'), `Expected "${expected}"`);
      topic.resources.forEach((r, ri) => {
        if (!resourceIds.has(r.id)) issue(at('resources', ri, 'id'), `Unknown resource "${r.id}"`);
      });
      topic.prerequisites.forEach((p, pi) => {
        if (p === topic.id) issue(at('prerequisites', pi), 'A topic cannot be its own prerequisite');
        else if (!topicIds.has(p)) issue(at('prerequisites', pi), `Unknown topic "${p}"`);
      });
      topic.assessment.questionIds.forEach((qid, qi) => {
        const q = questions.get(qid);
        if (!q) issue(at('assessment', 'questionIds', qi), `Unknown question "${qid}"`);
        else if (q.topic !== topic.id)
          issue(at('assessment', 'questionIds', qi), `Question "${qid}" belongs to "${q.topic}"`);
      });
      topic.assessment.challengeIds.forEach((id, ci) => {
        const challenge = challenges.get(id);
        if (!challenge) issue(at('assessment', 'challengeIds', ci), `Unknown challenge "${id}"`);
        else if (!challenge.topics.includes(topic.id))
          issue(at('assessment', 'challengeIds', ci), `Challenge "${id}" does not list topic "${topic.id}"`);
      });
    });
  });

  c.library.forEach((item, i) => {
    item.tracks?.forEach((t, j) => {
      if (!trackIds.has(t)) issue(['library', i, 'tracks', j], `Unknown track "${t}"`);
    });
  });

  c.questions.forEach((q, i) => {
    if (!topicIds.has(q.topic)) issue(['questions', i, 'topic'], `Unknown topic "${q.topic}"`);
    if (!q.id.startsWith(`${q.topic}.`))
      issue(['questions', i, 'id'], `Question ids start with their topic: "${q.topic}.q01"`);
    if (q.type === 'coding' && !challenges.has(q.challenge)) {
      issue(['questions', i, 'challenge'], `Unknown challenge "${q.challenge}"`);
    }
  });

  c.challenges.forEach((ch, i) => {
    ch.topics.forEach((t, j) => {
      if (!topicIds.has(t)) issue(['challenges', i, 'topics', j], `Unknown topic "${t}"`);
    });
  });
}

const ContentShape = z.strictObject({
  tracks: z.array(Track).min(1),
  resources: z.array(WebResource),
  library: z.array(LibraryItem),
  questions: z.array(Question),
  challenges: z.array(Challenge),
});
type ContentInput = z.infer<typeof ContentShape>;

/** Every content file, validated together so ids can point across files. */
export const Content = ContentShape.superRefine(checkReferences);

export type Id = z.infer<typeof Id>;
export type Technology = z.infer<typeof Technology>;
export type Priority = z.infer<typeof Priority>;
export type Level = z.infer<typeof Level>;
export type ResourceType = z.infer<typeof ResourceType>;
export type WebResource = z.infer<typeof WebResource>;
export type Verdict = z.infer<typeof Verdict>;
export type LibraryItem = z.infer<typeof LibraryItem>;
export type SkipItem = z.infer<typeof SkipItem>;
export type Build = z.infer<typeof Build>;
export type Module = z.infer<typeof Module>;
export type Topic = z.infer<typeof Topic>;
/** A topic with the five-part template filled in: a draft or a published lesson. */
export type WrittenTopic = DraftTopic | PublishedTopic;
export const isWritten = (topic: Topic): topic is WrittenTopic => topic.status !== 'outline';
export type CodeExample = z.infer<typeof CodeExample>;
export type TopicResource = z.infer<typeof TopicResource>;
export type TopicOutline = z.infer<typeof TopicOutline>;
export type DraftTopic = z.infer<typeof DraftTopic>;
export type PublishedTopic = z.infer<typeof PublishedTopic>;
export type Track = z.infer<typeof Track>;
export type Question = z.infer<typeof Question>;
export type Challenge = z.infer<typeof Challenge>;
export type Content = z.infer<typeof Content>;
