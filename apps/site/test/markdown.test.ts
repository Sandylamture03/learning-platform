import { describe, expect, it } from 'vitest';
import { MarkdownError, renderInline, renderMarkdown } from '../src/markdown.ts';

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
        '- second',
        '',
        '1. one',
        '',
        '### Try it',
        '',
        '```js',
        "const a = '<b>';",
        '```',
      ].join('\n'),
      { name: 'lesson.md' },
    );
    expect(html.value).toBe(
      [
        '<h2 id="what-this-is">What <code>this</code> is</h2>',
        '<p>One paragraph over two lines.</p>',
        '<ul>\n<li>first</li>\n<li>second</li>\n</ul>',
        '<ol>\n<li>one</li>\n</ol>',
        '<h3 id="try-it">Try it</h3>',
        '<pre class="code"><code>const a = &#39;&lt;b&gt;&#39;;</code></pre>',
        '',
      ].join('\n'),
    );
    expect(headings.map(({ level, id, html }) => [level, id, html.value])).toEqual([
      [2, 'what-this-is', 'What <code>this</code> is'],
      [3, 'try-it', 'Try it'],
    ]);
  });

  it('escapes text, so a lesson can never inject markup', () => {
    expect(renderMarkdown('Use <script> & "quotes" carefully.', { name: 'lesson.md' }).html.value).toBe(
      '<p>Use &lt;script&gt; &amp; &quot;quotes&quot; carefully.</p>\n',
    );
  });

  it('links to other lessons through the page, and fails for a lesson that is not written', () => {
    const lessonHref = (id: string) => (id === 'event-loop' ? 'event-loop.html' : undefined);
    const source = 'See [the event loop](lesson:event-loop).';
    expect(renderMarkdown(source, { name: 'lesson.md', lessonHref }).html.value).toBe(
      '<p>See <a href="event-loop.html">the event loop</a>.</p>\n',
    );
    expect(() => renderMarkdown('See [closures](lesson:closures).', { name: 'lesson.md', lessonHref })).toThrow(
      'lesson.md: “lesson:closures” is not a written lesson',
    );
  });

  it('passes parse errors on, with the file and line', () => {
    expect(() => renderMarkdown('Fine.\n\n<div>raw</div>', { name: 'lesson.md' })).toThrow(MarkdownError);
    expect(() => renderMarkdown('Fine.\n\n<div>raw</div>', { name: 'lesson.md' })).toThrow('lesson.md:3:');
  });
});

describe('renderInline', () => {
  it('renders code, strong, emphasis and https links', () => {
    expect(
      renderInline('Use `a ** b`, **not** *this*, and [MDN](https://developer.mozilla.org)', { name: 'note' }).value,
    ).toBe(
      'Use <code>a ** b</code>, <strong>not</strong> <em>this</em>, and <a href="https://developer.mozilla.org">MDN</a>',
    );
  });
});
