import type { Model } from '@/application/plan/derive';

import { FlowShell } from './flow-shell.client';
import { flowViews } from './flow-views';
import type { FlowViewsOptions } from './stop-side';

export interface FlowViewerProps extends FlowViewsOptions {
  readonly model: Model;
  readonly flowId: string;
  /** Open on the sequence rather than the diagram. */
  readonly view?: 'diagram' | 'sequence';
  /** Remember the view the reader picks under this name. */
  readonly keep?: string;
}

// A flow walked one stop at a time: the drawing with the stop lit, the screens it passes through, and what happens.
export function FlowViewer({ model, flowId, view, keep, ...options }: FlowViewerProps) {
  const parts = flowViews(model, flowId, options);
  if (parts === null) return <p>This flow has no steps.</p>;
  return <FlowShell {...parts} keep={keep} view={view} views={['diagram', 'sequence']} />;
}
