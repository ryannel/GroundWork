import type { Model } from '@/application/plan/derive';

import { FlowShell } from './flow-shell.client';
import { type FlowViewsOptions, flowViews } from './flow-views';

export interface FlowViewerProps extends FlowViewsOptions {
  readonly model: Model;
  readonly flowId: string;
  /** Open on the stop that holds this step. */
  readonly stepId?: string;
  /** Open on the sequence rather than the diagram. */
  readonly view?: 'diagram' | 'sequence';
  /** Remember the view the reader picks under this name. */
  readonly keep?: string;
}

// A flow walked one stop at a time: the drawing with the stop lit, the screens it passes through, and what happens.
export function FlowViewer({ model, flowId, stepId, view, keep, ...options }: FlowViewerProps) {
  const parts = flowViews(model, flowId, options);
  if (parts === null) return <p>This flow has no steps.</p>;
  const start = parts.stops.findIndex(
    (s) => stepId !== undefined && s.key.split('+').includes(stepId),
  );
  return (
    <FlowShell
      {...parts}
      keep={keep}
      start={Math.max(start, 0)}
      view={view}
      views={['diagram', 'sequence']}
    />
  );
}
