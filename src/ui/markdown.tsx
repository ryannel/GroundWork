import { Fragment, type ReactNode } from 'react';

import { type Inline, parseInline, parseMarkdown } from '@/shared/markdown';

/** Draws a citation [[id]]; without one the id shows as code. */
type RenderRef = (id: string) => ReactNode;

interface MarkdownProps {
  readonly text: string | null | undefined;
  readonly renderRef?: RenderRef;
}

const asCode: RenderRef = (id) => <code>{id}</code>;

function runNode(run: Inline, renderRef: RenderRef) {
  switch (run.kind) {
    case 'text': {
      return <Fragment key={run.key}>{run.text}</Fragment>;
    }
    case 'code': {
      return <code key={run.key}>{run.text}</code>;
    }
    case 'strong': {
      return (
        <strong key={run.key}>
          <Runs inlines={run.children} renderRef={renderRef} />
        </strong>
      );
    }
    case 'em': {
      return (
        <em key={run.key}>
          <Runs inlines={run.children} renderRef={renderRef} />
        </em>
      );
    }
    case 'link': {
      return (
        <a
          href={run.href}
          key={run.key}
          rel="noopener"
          target="_blank"
          title={run.short ? run.href : undefined}
        >
          {run.text}
        </a>
      );
    }
    case 'ref': {
      return <Fragment key={run.key}>{renderRef(run.id)}</Fragment>;
    }
  }
}

function Runs({
  inlines,
  renderRef,
}: {
  readonly inlines: readonly Inline[];
  readonly renderRef: RenderRef;
}) {
  return inlines.map((run) => runNode(run, renderRef));
}

// Plan prose as React: paragraphs, lists and quotes, with each [[id]] drawn by renderRef. It renders bare
// elements, so the caller's container sets the type.
export function Markdown({ text, renderRef = asCode }: MarkdownProps) {
  return parseMarkdown(text).map((block) => {
    if (block.kind === 'list') {
      const items = block.items.map((item) => (
        <li key={item.key}>
          <Runs inlines={item.inlines} renderRef={renderRef} />
        </li>
      ));
      return block.ordered ? <ol key={block.key}>{items}</ol> : <ul key={block.key}>{items}</ul>;
    }
    const runs = <Runs inlines={block.inlines} renderRef={renderRef} />;
    return block.kind === 'quote' ? (
      <blockquote key={block.key}>{runs}</blockquote>
    ) : (
      <p key={block.key}>{runs}</p>
    );
  });
}

/** One line of prose with no block around it: for a title or a table cell. */
export function InlineMarkdown({ text, renderRef = asCode }: MarkdownProps) {
  return <Runs inlines={parseInline(text ?? '')} renderRef={renderRef} />;
}
