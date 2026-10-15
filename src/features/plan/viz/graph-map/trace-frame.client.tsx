'use client';

import type { ReactNode } from 'react';

interface TraceFrameProps {
  readonly className: string | undefined;
  readonly children: ReactNode;
}

const ROW = '[data-sg]';

function light(frame: HTMLElement, subgraph: string | null): void {
  frame.toggleAttribute('data-tracing', subgraph !== null);
  for (const op of frame.querySelectorAll<HTMLElement>('[data-sgs]')) {
    op.toggleAttribute(
      'data-lit',
      subgraph !== null && (op.dataset.sgs ?? '').split(' ').includes(subgraph),
    );
  }
  for (const row of frame.querySelectorAll<HTMLElement>(ROW)) {
    row.toggleAttribute('data-lit', subgraph !== null && row.dataset.sg === subgraph);
  }
}

const subgraphOf = (target: EventTarget | null): string | null =>
  target instanceof Element ? (target.closest<HTMLElement>(ROW)?.dataset.sg ?? null) : null;

// Hover or focus a subgraph and the operations that reach it light up; nothing else on the picture changes.
export function TraceFrame({ className, children }: TraceFrameProps) {
  return (
    <div
      className={className}
      onBlur={(event) => {
        light(event.currentTarget, null);
      }}
      onFocus={(event) => {
        light(event.currentTarget, subgraphOf(event.target));
      }}
      onPointerLeave={(event) => {
        light(event.currentTarget, null);
      }}
      onPointerOver={(event) => {
        light(event.currentTarget, subgraphOf(event.target));
      }}
      role="presentation"
    >
      {children}
    </div>
  );
}
