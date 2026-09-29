import { describe, expect, it } from 'vitest';
import {
  type Block,
  lessonTarget,
  linkTargets,
  MarkdownError,
  parseInline,
  parseMarkdown,
  plainText,
} from '../src/index.ts';

const parse = (source: string) => parseMarkdown(source, 'lesson.md');

describe('parseMarkdown', () => {
  it('parses headings with ids, paragraphs, lists and code blocks', () => {
    const source = [
      '## What `this` is',
      '',
      'One paragraph',
      'over two lines.',
      '',
      '- first',
      '- second, which wraps',
      '  onto a second line',
      '',
      '1. one',
      '2. two',
      '',
      '### Try it',
      '',
      '```js',
      "const a = '<b>';",
      '',
      'if (a) console.log(a);',
      '```',
    ].join('\n');
    expect(parse(source)).toEqual<Block[]>([
      {
        type: 'heading',
        level: 2,
        id: 'what-this-is',
        children: [
          { type: 'text', text: 'What ' },
          { type: 'code', text: 'this' },
          { type: 'text', text: ' is' },
        ],
      },
      { type: 'paragraph', children: [{ type: 'text', text: 'One paragraph over two lines.' }] },
      {
        type: 'list',
        ordered: false,
        items: [[{ type: 'text', text: 'first' }], [{ type: 'text', text: 'second, which wraps onto a second line' }]],
      },
      { type: 'list', ordered: true, items: [[{ type: 'text', text: 'one' }], [{ type: 'text', text: 'two' }]] },
      { type: 'heading', level: 3, id: 'try-it', children: [{ type: 'text', text: 'Try it' }] },
      { type: 'code', language: 'js', code: "const a = '<b>';\n\nif (a) console.log(a);" },
    ]);
  });

  it('keeps markup as text: renderers escape it', () => {
    expect(parse('Use <script> & "quotes".')).toEqual([
      { type: 'paragraph', children: [{ type: 'text', text: 'Use <script> & "quotes".' }] },
    ]);
  });

  it.each([
    ['# Title', 'lesson.md:1: Use ## or ### for headings'],
    ['#### Deep', 'lesson.md:1: Use ## or ### for headings'],
    ['<div>raw</div>', 'lesson.md:1: Unsupported Markdown'],
    ['| a | b |', 'lesson.md:1: Unsupported Markdown'],
    ['> quoted', 'lesson.md:1: Unsupported Markdown'],
    ['![alt](https://example.com/a.png)', 'lesson.md:1: Unsupported Markdown'],
    ['* star bullet', 'lesson.md:1: Unsupported Markdown'],
    ['Text\n\n    indented code', 'lesson.md:3: Unsupported Markdown'],
    ['Text\n---', 'lesson.md:2: Unsupported Markdown inside a paragraph'],
    ['```js\nno end', 'lesson.md:1: This code block is never closed'],
    ['- item\n  - nested', 'lesson.md:2: Each line of a bulleted list'],
    ['- item\nnot indented', 'lesson.md:2: Each line of a bulleted list'],
    ['## Same\n\n## Same', 'lesson.md:3: Two headings make the same id "same"'],
    ['## ***', 'lesson.md:1: Unclosed or unsupported inline Markdown'],
    ['Unclosed `code', 'lesson.md:1: Unclosed or unsupported inline Markdown'],
    ['A [link](http://example.com)', 'lesson.md:1: Cannot link to “http://example.com”'],
    ['A [link](lesson:Not_An_Id)', 'lesson.md:1: Cannot link to “lesson:Not_An_Id”'],
  ])('rejects %j', (source, message) => {
    expect(() => parse(source)).toThrow(MarkdownError);
    expect(() => parse(source)).toThrow(message);
  });
});

describe('parseInline', () => {
  it('parses code, strong, emphasis and links, nesting all but code', () => {
    expect(parseInline('Use `a ** b`, **not `this`** *here*: [MDN](https://developer.mozilla.org)', 'note')).toEqual([
      { type: 'text', text: 'Use ' },
      { type: 'code', text: 'a ** b' },
      { type: 'text', text: ', ' },
      {
        type: 'strong',
        children: [
          { type: 'text', text: 'not ' },
          { type: 'code', text: 'this' },
        ],
      },
      { type: 'text', text: ' ' },
      { type: 'em', children: [{ type: 'text', text: 'here' }] },
      { type: 'text', text: ': ' },
      { type: 'link', target: 'https://developer.mozilla.org', children: [{ type: 'text', text: 'MDN' }] },
    ]);
  });

  it('leaves a lone asterisk alone', () => {
    expect(parseInline('2 * 3 is 6', 'note')).toEqual([{ type: 'text', text: '2 * 3 is 6' }]);
  });

  it('names the field in its errors', () => {
    expect(() => parseInline('**unclosed', 'objective')).toThrow(
      'objective: Unclosed or unsupported inline Markdown in “**unclosed”',
    );
  });
});

describe('helpers', () => {
  it('finds every link target, and the topic a lesson link points to', () => {
    const blocks = parse('See [the loop](lesson:event-loop).\n\n- **[MDN](https://developer.mozilla.org)**');
    expect(linkTargets(blocks)).toEqual(['lesson:event-loop', 'https://developer.mozilla.org']);
    expect(lessonTarget('lesson:event-loop')).toBe('event-loop');
    expect(lessonTarget('https://developer.mozilla.org')).toBeUndefined();
  });

  it('reads the plain text out of formatted text', () => {
    expect(plainText(parseInline('**Bold** and `code`', 'note'))).toBe('Bold and code');
  });
});
