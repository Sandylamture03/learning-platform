/**
 * Renders lesson Markdown as HTML for the static site. @lp/markdown parses the text (and rejects anything outside
 * the lesson subset); this file turns its tree into markup, escaping every piece of text on the way.
 */
import { type Block, type Inline, lessonTarget, MarkdownError, parseInline, parseMarkdown } from '@lp/markdown';
import { type HtmlValue, html, type SafeHtml } from './html.ts';

export { MarkdownError };

/** Turns a lesson's topic id into an href, or returns undefined when there is no such lesson. */
export type LessonLinker = (topicId: string) => string | undefined;

export interface MarkdownOptions {
  /** Where the text comes from, for error messages: "theory/javascript/event-loop.md". */
  name: string;
  /** Needed only when the text links to other lessons with lesson:<topic-id>. */
  lessonHref?: LessonLinker;
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

function inlineNode(node: Inline, options: MarkdownOptions): HtmlValue {
  switch (node.type) {
    case 'text':
      return node.text;
    case 'code':
      return html`<code>${node.text}</code>`;
    case 'strong':
      return html`<strong>${inlineHtml(node.children, options)}</strong>`;
    case 'em':
      return html`<em>${inlineHtml(node.children, options)}</em>`;
    case 'link': {
      const topicId = lessonTarget(node.target);
      const href = topicId === undefined ? node.target : options.lessonHref?.(topicId);
      if (href === undefined) throw new MarkdownError(`${options.name}: “${node.target}” is not a written lesson`);
      return html`<a href="${href}">${inlineHtml(node.children, options)}</a>`;
    }
  }
}

function inlineHtml(nodes: readonly Inline[], options: MarkdownOptions): SafeHtml {
  return html`${nodes.map((node) => inlineNode(node, options))}`;
}

/** Renders one line of inline Markdown, such as a learning objective or a hint. */
export function renderInline(text: string, options: MarkdownOptions): SafeHtml {
  return inlineHtml(parseInline(text, options.name), options);
}

function blockHtml(block: Block, options: MarkdownOptions): SafeHtml {
  switch (block.type) {
    case 'heading': {
      const body = inlineHtml(block.children, options);
      return block.level === 2 ? html`<h2 id="${block.id}">${body}</h2>` : html`<h3 id="${block.id}">${body}</h3>`;
    }
    case 'paragraph':
      return html`<p>${inlineHtml(block.children, options)}</p>`;
    case 'list': {
      const items = block.items.map((item) => html`<li>${inlineHtml(item, options)}</li>\n`);
      return block.ordered ? html`<ol>\n${items}</ol>` : html`<ul>\n${items}</ul>`;
    }
    case 'code':
      return html`<pre class="code"><code>${block.code}</code></pre>`;
  }
}

/** Renders a whole document: the theory of a lesson. */
export function renderMarkdown(source: string, options: MarkdownOptions): Rendered {
  const blocks = parseMarkdown(source, options.name);
  const headings = blocks.flatMap((block) =>
    block.type === 'heading' ? [{ level: block.level, id: block.id, html: inlineHtml(block.children, options) }] : [],
  );
  return { html: html`${blocks.map((block) => html`${blockHtml(block, options)}\n`)}`, headings };
}
