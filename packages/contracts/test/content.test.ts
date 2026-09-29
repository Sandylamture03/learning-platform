import { describe, expect, it } from 'vitest';
import { Content, Topic } from '../src/index.ts';

// A tiny but complete content set; each test breaks one thing.
function validContent() {
  return {
    tracks: [
      {
        id: 'html-css',
        order: 1,
        title: 'HTML5 & CSS3',
        technologies: ['html5', 'css3'],
        status: 'outline',
        summary: 'The HTML and CSS that real front-end tickets need.',
        pace: { weeks: 2, effort: '1 hour a day' },
        sources: ['HTML5 & CSS3 80 20 Job-Ready Roadmap.docx'],
        skip: [{ item: 'Floats for layout', instead: 'Flexbox and Grid' }],
        modules: [
          {
            id: 'week-1',
            title: 'Semantic HTML',
            weeks: [1, 1],
            learn: ['Landmarks'],
            doneWhen: ['0 validator errors'],
            resources: ['mdn-html'],
          },
          { id: 'week-2', title: 'The box model', weeks: [2, 2] },
        ],
        topics: [
          {
            id: 'semantic-html',
            title: 'Semantic HTML',
            priority: 'P0',
            module: 'week-1',
            why: 'Screen readers and search engines read it.',
            status: 'outline',
          },
          {
            id: 'box-model',
            title: 'Box model',
            priority: 'P0',
            module: 'week-2',
            why: 'Every size bug starts here.',
            status: 'outline',
          },
        ],
      },
    ],
    resources: [
      { id: 'mdn-html', title: 'MDN: HTML', url: 'https://developer.mozilla.org/en-US/docs/Web/HTML', type: 'docs' },
    ],
    library: [],
    questions: [],
    challenges: [],
  };
}

type Fixture = ReturnType<typeof validContent>;

function issuesOf(input: unknown) {
  const result = Content.safeParse(input);
  expect(result.success).toBe(false);
  return (result.error?.issues ?? []).map((i) => ({ path: i.path.join('.'), message: i.message }));
}

describe('Content', () => {
  it('accepts valid content', () => {
    const result = Content.safeParse(validContent());
    expect(result.error?.issues).toBeUndefined();
    expect(result.success).toBe(true);
  });

  it('rejects a malformed topic', () => {
    const content: Fixture = validContent();
    const topic = content.tracks[0]?.topics[0] as Record<string, unknown>;
    topic.id = 'Semantic HTML';
    topic.priority = 'P9';
    delete topic.why;

    const paths = issuesOf(content).map((i) => i.path);
    expect(paths).toContain('tracks.0.topics.0.id');
    expect(paths).toContain('tracks.0.topics.0.priority');
    expect(paths).toContain('tracks.0.topics.0.why');
  });

  it('rejects a topic that points at a module the track does not have', () => {
    const content = validContent();
    const topic = content.tracks[0]?.topics[1];
    if (topic) topic.module = 'week-9';
    expect(issuesOf(content)).toContainEqual({
      path: 'tracks.0.topics.1.module',
      message: 'Unknown module "week-9" in track "html-css"',
    });
  });

  it('rejects unknown fields, so typos surface', () => {
    const content = validContent();
    const module = content.tracks[0]?.modules[0] as Record<string, unknown>;
    module.doneWen = ['typo'];
    expect(issuesOf(content)[0]?.path).toBe('tracks.0.modules.0');
  });

  it('rejects links to resources that do not exist', () => {
    const content = validContent();
    content.tracks[0]?.modules[0]?.resources?.push('css-tricks-flexbox');
    expect(issuesOf(content)).toContainEqual({
      path: 'tracks.0.modules.0.resources.1',
      message: 'Unknown resource "css-tricks-flexbox": add it to resources.json first',
    });
  });

  it('rejects duplicate topic ids across tracks', () => {
    const content = validContent();
    const [first] = content.tracks;
    if (!first) throw new Error('fixture has a track');
    content.tracks.push({ ...structuredClone(first), id: 'css-extra', order: 2 });
    expect(issuesOf(content).map((i) => i.message)).toContain(
      'Duplicate topic id "semantic-html" (also in track "html-css")',
    );
  });

  it('rejects two resources for the same page', () => {
    const content = validContent();
    content.resources.push({
      id: 'mdn-html-again',
      title: 'HTML on MDN',
      url: 'https://www.developer.mozilla.org/en-US/docs/Web/HTML/',
      type: 'docs',
    });
    expect(issuesOf(content).map((i) => i.path)).toEqual(['resources.1.url']);
  });

  it('rejects weeks outside the track pace', () => {
    const content = validContent();
    const module = content.tracks[0]?.modules[1];
    if (module) module.weeks = [2, 3];
    expect(issuesOf(content)).toContainEqual({
      path: 'tracks.0.modules.1.weeks',
      message: "Week 3 is past the track's 2-week pace",
    });
  });
});

describe('Topic', () => {
  const written = {
    id: 'box-model',
    title: 'Box model',
    priority: 'P0',
    module: 'week-2',
    why: 'Every size bug starts here.',
    summary: 'How width, padding, border and margin add up.',
    level: 'foundation',
    difficulty: 1,
    estMinutes: 45,
    prerequisites: [],
    objectives: ['Explain box-sizing'],
    theory: 'theory/html-css/box-model.md',
    examples: [],
    resources: [],
    assessment: { passMark: 0.8, questionIds: [], challengeIds: [] },
    version: 1,
    updatedAt: '2026-09-29',
  };

  it('lets a draft be incomplete', () => {
    expect(Topic.safeParse({ ...written, status: 'draft' }).success).toBe(true);
  });

  it('holds a published topic to the five-part template', () => {
    const result = Topic.safeParse({ ...written, status: 'published' });
    const messages = result.error?.issues.map((i) => i.message) ?? [];
    expect(messages).toEqual(
      expect.arrayContaining([
        'A published topic has exactly three learning objectives',
        'A published topic has two to four examples',
        'A published topic links three to five resources',
        'A published topic has four to six questions',
        'A published topic has a coding task',
      ]),
    );
  });
});
