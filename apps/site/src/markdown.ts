/**
 * A small, strict Markdown renderer for lesson text. It knows exactly what the lessons use and nothing more:
 *
 *   ## Heading, ### Heading         h2 and h3, each with an id made from its text
 *   paragraphs                      lines next to each other join into one paragraph
 *   - item / 1. item                one level of list; indent a wrapped line by two spaces
 *   ```js … ```                     a code block, shown exactly as written
 *   `code`, **strong**, *emphasis*, [text](https://…)
 *
 * Every piece of text is escaped, so a lesson can never inject markup. Anything else (raw HTML, tables,
 * images, quotes, nested lists, an unclosed backtick) throws a MarkdownError naming the file and line,
 * so a typo stops the build instead of showing up as odd output on the page.
 */
import { type HtmlValue, html, type SafeHtml } from './html.ts';

/** Turns a link target into an href, or returns undefined when the target is not allowed. */
export type LinkResolver = (target: string) => string | undefined;

export interface MarkdownOptions {
  /** Where the text comes from, for error messages: "theory/javascript/event-loop.md". */
  name: string;
  /** Allows only https:// links unless the caller knows more targets. */
  resolveLink?: LinkResolver;
}

export interface Heading {
  level: 2 | 3;
  id: string;
  /** The heading's content, with its inline Markdown rendered. */
  html: SafeHtml;
}

export interface Rendered {
  html: SafeHtml;
  headings: Heading[];
}

export class MarkdownError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MarkdownError';
  }
}

export const httpsOnly: LinkResolver = (target) => (target.startsWith('https://') ? target : undefined);

// `code`, **strong**, *emphasis* and [text](target). Code comes first, so markers inside it stay literal.
const INLINE = /`([^`]+)`|\*\*(.+?)\*\*|\*([^\s*](?:[^*]*[^\s*])?)\*|\[([^\]]+)\]\(([^()\s]+)\)/g;
// What is left in plain text after the matches above must not look like an unfinished marker.
const STRAY = /`|\*\*|\]\(/;

const FENCE = /^```([a-z]*)$/;
const HEADING = /^(#+) (.+)$/;
const BULLET = /^- (.+)$/;
const NUMBERED = /^\d+\. (.+)$/;
/** Raw HTML, tables, quotes, images, other list markers, indented code and horizontal rules. */
const UNSUPPORTED = /^(?:<|\||>|!\[|[*+] |\s|-{3,}|={3,}|_{3,}|~~~)/;

function inline(text: string, resolveLink: LinkResolver, fail: (message: string) => never): SafeHtml {
  const parts: HtmlValue[] = [];
  const plain = (part: string) => {
    if (STRAY.test(part)) fail(`Unclosed or unsupported inline Markdown in “${part.trim()}”`);
    parts.push(part);
  };
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    const [whole, code, strong, em, label = '', target = ''] = match;
    plain(text.slice(last, match.index));
    if (code !== undefined) parts.push(html`<code>${code}</code>`);
    else if (strong !== undefined) parts.push(html`<strong>${inline(strong, resolveLink, fail)}</strong>`);
    else if (em !== undefined) parts.push(html`<em>${inline(em, resolveLink, fail)}</em>`);
    else {
      const href = resolveLink(target) ?? fail(`Cannot link to “${target}”`);
      parts.push(html`<a href="${href}">${inline(label, resolveLink, fail)}</a>`);
    }
    last = match.index + whole.length;
  }
  plain(text.slice(last));
  return html`${parts}`;
}

/** Renders one line of inline Markdown, such as a learning objective or a hint. */
export function renderInline(text: string, { name, resolveLink = httpsOnly }: MarkdownOptions): SafeHtml {
  return inline(text, resolveLink, (message) => {
    throw new MarkdownError(`${name}: ${message}`);
  });
}

/** "What `this` is" -> "what-this-is" */
function slug(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Renders a whole document: the theory of a lesson. */
export function renderMarkdown(source: string, { name, resolveLink = httpsOnly }: MarkdownOptions): Rendered {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: SafeHtml[] = [];
  const headings: Heading[] = [];
  const ids = new Set<string>();
  const fail = (index: number, message: string): never => {
    throw new MarkdownError(`${name}:${index + 1}: ${message}`);
  };
  const text = (value: string, index: number) => inline(value, resolveLink, (message) => fail(index, message));
  const lineAt = (index: number) => lines[index] ?? '';
  const isBlank = (index: number) => lineAt(index).trim() === '';

  let i = 0;
  while (i < lines.length) {
    const line = lineAt(i);
    const start = i;
    if (isBlank(i)) {
      i++;
      continue;
    }

    if (FENCE.test(line)) {
      const code: string[] = [];
      i++;
      while (i < lines.length && lineAt(i) !== '```') code.push(lineAt(i++));
      if (i === lines.length) fail(start, 'This code block is never closed: end it with a line of ```');
      i++;
      blocks.push(html`<pre class="code"><code>${code.join('\n')}</code></pre>`);
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      const [, hashes = '', content = ''] = heading;
      if (hashes.length !== 2 && hashes.length !== 3) {
        fail(i, 'Use ## or ### for headings: the page title is the only h1');
      }
      const level = hashes.length === 2 ? 2 : 3;
      const id = slug(content) || fail(i, 'A heading needs letters or digits');
      if (ids.has(id)) fail(i, `Two headings make the same id "${id}"`);
      ids.add(id);
      const body = text(content, i);
      headings.push({ level, id, html: body });
      blocks.push(level === 2 ? html`<h2 id="${id}">${body}</h2>` : html`<h3 id="${id}">${body}</h3>`);
      i++;
      continue;
    }

    if (BULLET.test(line) || NUMBERED.test(line)) {
      const ordered = NUMBERED.test(line);
      const marker = ordered ? NUMBERED : BULLET;
      const items: { text: string; line: number }[] = [];
      for (; i < lines.length && !isBlank(i); i++) {
        const current = lineAt(i);
        const item = marker.exec(current);
        const last = items.at(-1);
        if (item) items.push({ text: item[1] ?? '', line: i });
        else if (last && /^ {2,}\S/.test(current) && !/^\s+(?:[-*+]|\d+\.) /.test(current)) {
          last.text += ` ${current.trim()}`;
        } else {
          fail(
            i,
            `Each line of a ${ordered ? 'numbered' : 'bulleted'} list starts with "${ordered ? '1. ' : '- '}", or with two spaces to continue the item above; lists do not nest`,
          );
        }
      }
      const lis = items.map((item) => html`<li>${text(item.text, item.line)}</li>\n`);
      blocks.push(ordered ? html`<ol>\n${lis}</ol>` : html`<ul>\n${lis}</ul>`);
      continue;
    }

    if (UNSUPPORTED.test(line)) {
      fail(i, 'Unsupported Markdown: use paragraphs, ## and ### headings, - and 1. lists, and ``` code blocks');
    }
    const paragraph: string[] = [];
    for (; i < lines.length && !isBlank(i); i++) {
      const current = lineAt(i);
      if ([FENCE, HEADING, BULLET, NUMBERED].some((block) => block.test(current))) break;
      if (UNSUPPORTED.test(current)) fail(i, 'Unsupported Markdown inside a paragraph');
      paragraph.push(current.trim());
    }
    blocks.push(html`<p>${text(paragraph.join(' '), start)}</p>`);
  }

  return { html: html`${blocks.map((block) => html`${block}\n`)}`, headings };
}
