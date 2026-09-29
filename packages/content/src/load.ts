import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Content } from '@lp/contracts';

/** The content that ships with the repo. Tests and tools can point the loader at a copy instead. */
export const DATA_DIR = fileURLToPath(new URL('../data/', import.meta.url));

/** One problem, located by file and by the field inside it: `tracks/react.json topics[2].module`. */
export interface ContentIssue {
  file: string;
  path: string;
  message: string;
}

export type CheckResult = { ok: true; content: Content } | { ok: false; issues: ContentIssue[] };

export class ContentError extends Error {
  readonly issues: ContentIssue[];

  constructor(issues: ContentIssue[]) {
    super(`Content has ${issues.length} problem(s):\n${issues.map(formatIssue).join('\n')}`);
    this.name = 'ContentError';
    this.issues = issues;
  }
}

export function formatIssue(issue: ContentIssue): string {
  return `${issue.file}${issue.path ? ` ${issue.path}` : ''}: ${issue.message}`;
}

/** ['topics', 2, 'module'] -> "topics[2].module" */
function formatPath(path: readonly PropertyKey[]): string {
  return path.reduce<string>((out, key) => {
    if (typeof key === 'number') return `${out}[${key}]`;
    return out ? `${out}.${String(key)}` : String(key);
  }, '');
}

/** Where an item in the combined content came from, so issues point at the right file. */
interface Origin {
  file: string;
  /** Index inside the file when the file holds an array; undefined when the file is the item. */
  index?: number;
}

/**
 * Reads every content file, validates them together, and reports every problem at once.
 *
 * Layout of `dir`:
 *   tracks/<track-id>.json      one track each (modules, topic outlines, skip list)
 *   resources.json              every web link, referenced by id
 *   library.json                files in your own study folders
 *   questions/*.json            Interview Vault questions (arrays), optional
 *   challenges/*.json           Practice Lab challenges (arrays), optional
 *   theory/<track>/<topic>.md   theory for written topics
 */
export function checkContent(dir: string = DATA_DIR): CheckResult {
  const issues: ContentIssue[] = [];

  const readJson = (file: string): unknown => {
    try {
      return JSON.parse(readFileSync(join(dir, file), 'utf8'));
    } catch (error) {
      const reason = error instanceof SyntaxError ? `Invalid JSON: ${error.message}` : 'File not found or unreadable';
      issues.push({ file, path: '', message: reason });
      return undefined;
    }
  };
  const jsonFilesIn = (folder: string): string[] =>
    existsSync(join(dir, folder))
      ? readdirSync(join(dir, folder))
          .filter((name) => name.endsWith('.json'))
          .sort()
          .map((name) => `${folder}/${name}`)
      : [];
  /** Files that each hold an array; items are combined and each remembers its file. */
  const readArrays = (folder: string) => {
    const items: unknown[] = [];
    const origins: Origin[] = [];
    for (const file of jsonFilesIn(folder)) {
      const data = readJson(file);
      if (data === undefined) continue;
      if (!Array.isArray(data)) {
        issues.push({ file, path: '', message: 'Expected an array' });
        continue;
      }
      data.forEach((item, index) => {
        items.push(item);
        origins.push({ file, index });
      });
    }
    return { items, origins };
  };

  const trackFiles = jsonFilesIn('tracks');
  if (trackFiles.length === 0) issues.push({ file: 'tracks/', path: '', message: 'No track files found' });
  const tracks = trackFiles.map(readJson);
  const resources = readJson('resources.json');
  const library = existsSync(join(dir, 'library.json')) ? readJson('library.json') : [];
  const questions = readArrays('questions');
  const challenges = readArrays('challenges');
  if (issues.length > 0) return { ok: false, issues };

  const origins: Record<string, Origin[] | string> = {
    tracks: trackFiles.map((file) => ({ file })),
    questions: questions.origins,
    challenges: challenges.origins,
    resources: 'resources.json',
    library: 'library.json',
  };
  const locate = (path: readonly PropertyKey[]): { file: string; path: string } => {
    const [key, index, ...rest] = path;
    const origin = origins[String(key)];
    if (typeof origin === 'string') return { file: origin, path: formatPath(path.slice(1)) };
    const item = typeof index === 'number' ? origin?.[index] : undefined;
    if (!item) return { file: 'content', path: formatPath(path) };
    return { file: item.file, path: formatPath(item.index === undefined ? rest : [item.index, ...rest]) };
  };

  const parsed = Content.safeParse({
    tracks,
    resources,
    library,
    questions: questions.items,
    challenges: challenges.items,
  });
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map((i) => ({ ...locate(i.path), message: i.message })) };
  }

  const content = parsed.data;
  content.tracks.forEach((track, i) => {
    const file = trackFiles[i] ?? '';
    if (file !== `tracks/${track.id}.json`) {
      issues.push({ file, path: 'id', message: `Name the file after the track id: tracks/${track.id}.json` });
    }
    track.topics.forEach((topic, ti) => {
      if (topic.status !== 'outline' && !existsSync(join(dir, topic.theory))) {
        issues.push({ file, path: `topics[${ti}].theory`, message: `Missing ${topic.theory}` });
      }
    });
  });
  if (issues.length > 0) return { ok: false, issues };

  content.tracks.sort((a, b) => a.order - b.order);
  return { ok: true, content };
}

/** Like checkContent, but throws a ContentError listing every problem. */
export function loadContent(dir: string = DATA_DIR): Content {
  const result = checkContent(dir);
  if (!result.ok) throw new ContentError(result.issues);
  return result.content;
}
