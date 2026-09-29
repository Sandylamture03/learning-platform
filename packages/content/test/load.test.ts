import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkContent, DATA_DIR, loadContent } from '../src/index.ts';

const CLI = fileURLToPath(new URL('../src/check.ts', import.meta.url));

describe('the imported content', () => {
  const content = loadContent();

  it('loads all five track outlines in catalogue order', () => {
    expect(content.tracks.map((t) => t.id)).toEqual(['html-css', 'javascript', 'typescript', 'react', 'nodejs']);
  });

  it('covers every technology in the stack', () => {
    const technologies = new Set(content.tracks.flatMap((t) => t.technologies));
    expect([...technologies].sort()).toEqual(['css3', 'html5', 'javascript', 'nodejs', 'react', 'typescript']);
  });

  it('gives every track modules, P0 topics and a skip list', () => {
    for (const track of content.tracks) {
      expect(track.modules.length, track.id).toBeGreaterThan(0);
      expect(
        track.topics.some((t) => t.priority === 'P0'),
        track.id,
      ).toBe(true);
      expect(track.skip.length, track.id).toBeGreaterThan(0);
    }
  });
});

describe('the content check', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'lp-content-'));
    cpSync(DATA_DIR, dir, { recursive: true });
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  function editTrack(id: string, edit: (track: { topics: Record<string, unknown>[] }) => void) {
    const file = join(dir, 'tracks', `${id}.json`);
    const track = JSON.parse(readFileSync(file, 'utf8'));
    edit(track);
    writeFileSync(file, JSON.stringify(track, null, 2));
  }

  it('names the file and the field of a malformed topic', () => {
    editTrack('react', (track) => {
      const topic = track.topics[2] ?? {};
      topic.priority = 'urgent';
      topic.module = 'week-99';
    });

    const result = checkContent(dir);
    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.issues).toEqual([
      {
        file: 'tracks/react.json',
        path: 'topics[2].priority',
        message: 'Invalid option: expected one of "P0"|"P1"|"P2"',
      },
    ]);
  });

  it('catches a reference to a module that does not exist', () => {
    editTrack('react', (track) => {
      const topic = track.topics[2] ?? {};
      topic.module = 'week-99';
    });
    const result = checkContent(dir);
    expect(result.ok ? [] : result.issues).toEqual([
      { file: 'tracks/react.json', path: 'topics[2].module', message: 'Unknown module "week-99" in track "react"' },
    ]);
  });

  it('reports broken JSON with its file name', () => {
    writeFileSync(join(dir, 'resources.json'), '[{ "id": "oops", }]');
    const result = checkContent(dir);
    expect(result.ok ? undefined : result.issues[0]?.file).toBe('resources.json');
  });

  it('wants each track file named after its track id', () => {
    renameSync(join(dir, 'tracks', 'react.json'), join(dir, 'tracks', 'react-js.json'));
    const result = checkContent(dir);
    expect(result.ok ? [] : result.issues).toEqual([
      { file: 'tracks/react-js.json', path: 'id', message: 'Name the file after the track id: tracks/react.json' },
    ]);
  });

  it('fails the command with exit code 1 and a readable message', () => {
    editTrack('html-css', (track) => {
      delete track.topics[0]?.why;
    });
    const run = spawnSync(process.execPath, [CLI, dir], { encoding: 'utf8' });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain(
      'tracks/html-css.json topics[0].why: Invalid input: expected string, received undefined',
    );
  });

  it('passes the command on the real content', () => {
    const run = spawnSync(process.execPath, [CLI], { encoding: 'utf8' });
    expect(run.stderr).not.toContain('problem');
    expect(run.status).toBe(0);
    expect(run.stdout).toMatch(/^Content OK: 5 tracks/);
  });
});
