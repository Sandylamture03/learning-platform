// Renders lesson Markdown as React elements, from the same tree the site renders as HTML (@lp/markdown), so a lesson
// reads the same in both. Text always goes in as text: nothing here sets HTML.
import type { TopicRef } from '@lp/contracts';
import { type Block, type Inline, lessonTarget, parseInline, parseMarkdown } from '@lp/markdown';
import { type ReactNode, useMemo } from 'react';
import { Link } from 'react-router';
import { paths } from './paths.ts';

interface Options {
  /** The lessons the text may link to with lesson:<topic-id>. */
  links: readonly TopicRef[];
}

// Lesson text is fixed: nodes never move, so their position is a stable key.
function inlineNode(node: Inline, key: number, options: Options): ReactNode {
  switch (node.type) {
    case 'text':
      return node.text;
    case 'code':
      return <code key={key}>{node.text}</code>;
    case 'strong':
      return <strong key={key}>{inline(node.children, options)}</strong>;
    case 'em':
      return <em key={key}>{inline(node.children, options)}</em>;
    case 'link': {
      const topicId = lessonTarget(node.target);
      if (topicId === undefined) {
        return (
          <a key={key} href={node.target}>
            {inline(node.children, options)}
          </a>
        );
      }
      const target = options.links.find((ref) => ref.id === topicId);
      // The API lists every lesson the text links to; without one, keep the words and drop the link.
      if (!target) return <span key={key}>{inline(node.children, options)}</span>;
      return (
        <Link key={key} to={paths.lesson(target.trackId, target.id)}>
          {inline(node.children, options)}
        </Link>
      );
    }
  }
}

function inline(nodes: readonly Inline[], options: Options): ReactNode[] {
  return nodes.map((node, i) => inlineNode(node, i, options));
}

function block(node: Block, key: number, options: Options): ReactNode {
  switch (node.type) {
    case 'heading':
      return node.level === 2 ? (
        <h2 key={key} id={node.id}>
          {inline(node.children, options)}
        </h2>
      ) : (
        <h3 key={key} id={node.id}>
          {inline(node.children, options)}
        </h3>
      );
    case 'paragraph':
      return <p key={key}>{inline(node.children, options)}</p>;
    case 'list': {
      const items = node.items.map((item, i) => <li key={i}>{inline(item, options)}</li>);
      return node.ordered ? <ol key={key}>{items}</ol> : <ul key={key}>{items}</ul>;
    }
    case 'code':
      return (
        <pre key={key} className="code">
          <code>{node.code}</code>
        </pre>
      );
  }
}

/** A whole document, such as a lesson's theory. */
export function Markdown({ source, name, links = [] }: { source: string; name: string; links?: readonly TopicRef[] }) {
  const blocks = useMemo(() => parseMarkdown(source, name), [source, name]);
  return <>{blocks.map((node, i) => block(node, i, { links }))}</>;
}

/** One line of inline Markdown, such as an objective or a hint. */
export function InlineMarkdown({
  text,
  name,
  links = [],
}: {
  text: string;
  name: string;
  links?: readonly TopicRef[];
}) {
  const nodes = useMemo(() => parseInline(text, name), [text, name]);
  return <>{inline(nodes, { links })}</>;
}

/** The ids and texts of a document's h2 headings, for a table of contents. */
export function useHeadings(source: string, name: string): { id: string; children: Inline[] }[] {
  return useMemo(
    () => parseMarkdown(source, name).flatMap((node) => (node.type === 'heading' && node.level === 2 ? [node] : [])),
    [source, name],
  );
}

export function InlineNodes({ nodes }: { nodes: readonly Inline[] }) {
  return <>{inline(nodes, { links: [] })}</>;
}
