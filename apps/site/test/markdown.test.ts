import { describe, expect, it } from 'vitest';
import { MarkdownError, renderInline, renderMarkdown } from '../src/markdown.ts';

const render = (source: string) => renderMarkdown(source, { name: 'lesson.md' }).html.value;
const inline = (text: string) => renderInline(text, { name: 'objective' }).value;

describe('renderMarkdown', () => {
  it('renders headings with ids, paragraphs, lists and code blocks', () => {
    const { html, headings } = renderMarkdown(
      [
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
      ].join('\n'),
      { name: 'lesson.md' },
    );
    expect(html.value).toBe(
      [
        '<h2 id="what-this-is">What <code>this</code> is</h2>',
        '<p>One paragraph over two lines.</p>',
        '<ul>\n<li>first</li>\n<li>second, which wraps onto a second line</li>\n</ul>',
        '<ol>\n<li>one</li>\n<li>two</li>\n</ol>',
        '<h3 id="try-it">Try it</h3>',
        '<pre class="code"><code>const a = &#39;&lt;b&gt;&#39;;\n\nif (a) console.log(a);</code></pre>',
        '',
      ].join('\n'),
    );
    expect(headings.map(({ level, id }) => [level, id])).toEqual([
      [2, 'what-this-is'],
      [3, 'try-it'],
    ]);
  });

  it('escapes text, so a lesson can never inject markup', () => {
    expect(render('Use <script> & "quotes" carefully.')).toBe(
      '<p>Use &lt;script&gt; &amp; &quot;quotes&quot; carefully.</p>\n',
    );
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
    ['Unclosed `code', 'lesson.md:1: Unclosed or unsupported inline Markdown'],
    ['A [link](http://example.com)', 'lesson.md:1: Cannot link to “http://example.com”'],
  ])('rejects %j', (source, message) => {
    expect(() => render(source)).toThrow(MarkdownError);
    expect(() => render(source)).toThrow(message);
  });

  it('asks the caller about link targets that are not https URLs', () => {
    const { html } = renderMarkdown('See [the event loop](lesson:event-loop).', {
      name: 'lesson.md',
      resolveLink: (target) => (target === 'lesson:event-loop' ? 'event-loop.html' : undefined),
    });
    expect(html.value).toBe('<p>See <a href="event-loop.html">the event loop</a>.</p>\n');
  });
});

describe('renderInline', () => {
  it('renders code, strong, emphasis and https links', () => {
    expect(inline('Use `a ** b`, **not** *this*, and [MDN](https://developer.mozilla.org)')).toBe(
      'Use <code>a ** b</code>, <strong>not</strong> <em>this</em>, and <a href="https://developer.mozilla.org">MDN</a>',
    );
  });

  it('nests inline code inside strong text', () => {
    expect(inline('**`await` pauses**')).toBe('<strong><code>await</code> pauses</strong>');
  });

  it('leaves a lone asterisk alone', () => {
    expect(inline('2 * 3 is 6')).toBe('2 * 3 is 6');
  });

  it('names the field in its errors', () => {
    expect(() => inline('**unclosed')).toThrow('objective: Unclosed or unsupported inline Markdown in “**unclosed”');
  });
});
