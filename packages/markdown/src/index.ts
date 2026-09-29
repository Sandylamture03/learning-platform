/**
 * The strict Markdown subset lessons are written in, parsed into a small tree that the site renders as HTML and
 * the app renders as React elements, so a lesson reads the same in both. It knows exactly what lessons use:
 *
 *   ## Heading, ### Heading         h2 and h3, each with an id made from its text
 *   paragraphs                      lines next to each other join into one paragraph
 *   - item / 1. item                one level of list; indent a wrapped line by two spaces
 *   ```js … ```                     a code block, kept exactly as written
 *   `code`, **strong**, *emphasis*, [text](https://…) and [text](lesson:<topic-id>)
 *
 * Anything else (raw HTML, tables, images, quotes, nested lists, an unclosed backtick, another kind of link)
 * throws a MarkdownError naming the source and line, so a typo stops the build instead of showing up as odd output.
 * The tree holds text, never markup: renderers escape it or put it in text nodes.
 */

export type Inline =
  | { type: 'text'; text: string }
  | { type: 'code'; text: string }
  | { type: 'strong'; children: Inline[] }
  | { type: 'em'; children: Inline[] }
  /** `target` is an https:// URL or lesson:<topic-id>; renderers turn the second into a link to that lesson. */
  | { type: 'link'; target: string; children: Inline[] };

export type Block =
  | { type: 'heading'; level: 2 | 3; id: string; children: Inline[] }
  | { type: 'paragraph'; children: Inline[] }
  | { type: 'list'; ordered: boolean; items: Inline[][] }
  | { type: 'code'; language: string; code: string };

export class MarkdownError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MarkdownError';
  }
}

/** A link to another lesson: lesson:<topic-id>. */
export const LESSON_LINK = /^lesson:([a-z0-9]+(?:-[a-z0-9]+)*)$/;

/** The topic id a lesson: link points to, or undefined for a web link. */
export function lessonTarget(target: string): string | undefined {
  return LESSON_LINK.exec(target)?.[1];
}

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

type Fail = (message: string) => never;

function inline(text: string, fail: Fail): Inline[] {
  const nodes: Inline[] = [];
  const plain = (part: string) => {
    if (STRAY.test(part)) fail(`Unclosed or unsupported inline Markdown in “${part.trim()}”`);
    if (part) nodes.push({ type: 'text', text: part });
  };
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    const [whole, code, strong, em, label = '', target = ''] = match;
    plain(text.slice(last, match.index));
    if (code !== undefined) nodes.push({ type: 'code', text: code });
    else if (strong !== undefined) nodes.push({ type: 'strong', children: inline(strong, fail) });
    else if (em !== undefined) nodes.push({ type: 'em', children: inline(em, fail) });
    else if (target.startsWith('https://') || LESSON_LINK.test(target)) {
      nodes.push({ type: 'link', target, children: inline(label, fail) });
    } else {
      fail(`Cannot link to “${target}”: use an https:// URL, or lesson:<topic-id> for another lesson`);
    }
    last = match.index + whole.length;
  }
  plain(text.slice(last));
  return nodes;
}

/** Parses one line of inline Markdown, such as a learning objective or a hint. `name` locates errors. */
export function parseInline(text: string, name: string): Inline[] {
  return inline(text, (message) => {
    throw new MarkdownError(`${name}: ${message}`);
  });
}

/** The text of inline nodes without their formatting. */
export function plainText(nodes: readonly Inline[]): string {
  return nodes.map((node) => ('children' in node ? plainText(node.children) : node.text)).join('');
}

/** "What `this` is" -> "what-this-is" */
function slug(nodes: readonly Inline[]): string {
  return plainText(nodes)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Parses a whole document, such as a lesson's theory. `name` locates errors: "theory/javascript/event-loop.md". */
export function parseMarkdown(source: string, name: string): Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  const ids = new Set<string>();
  const fail = (index: number, message: string): never => {
    throw new MarkdownError(`${name}:${index + 1}: ${message}`);
  };
  const text = (value: string, index: number) => inline(value, (message) => fail(index, message));
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

    const fence = FENCE.exec(line);
    if (fence) {
      const code: string[] = [];
      i++;
      while (i < lines.length && lineAt(i) !== '```') code.push(lineAt(i++));
      if (i === lines.length) fail(start, 'This code block is never closed: end it with a line of ```');
      i++;
      blocks.push({ type: 'code', language: fence[1] ?? '', code: code.join('\n') });
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      const [, hashes = '', content = ''] = heading;
      if (hashes.length !== 2 && hashes.length !== 3) {
        fail(i, 'Use ## or ### for headings: the page title is the only h1');
      }
      const children = text(content, i);
      const id = slug(children) || fail(i, 'A heading needs letters or digits');
      if (ids.has(id)) fail(i, `Two headings make the same id "${id}"`);
      ids.add(id);
      blocks.push({ type: 'heading', level: hashes.length === 2 ? 2 : 3, id, children });
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
      blocks.push({ type: 'list', ordered, items: items.map((item) => text(item.text, item.line)) });
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
    blocks.push({ type: 'paragraph', children: text(paragraph.join(' '), start) });
  }
  return blocks;
}

/** Every link target in a document or in inline text, in order. */
export function linkTargets(nodes: readonly (Block | Inline)[]): string[] {
  return nodes.flatMap((node): string[] => {
    switch (node.type) {
      case 'link':
        return [node.target, ...linkTargets(node.children)];
      case 'heading':
      case 'paragraph':
      case 'strong':
      case 'em':
        return linkTargets(node.children);
      case 'list':
        return node.items.flatMap((item) => linkTargets(item));
      default:
        return [];
    }
  });
}
