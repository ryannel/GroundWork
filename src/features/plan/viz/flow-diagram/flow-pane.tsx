import type { Model } from '@/application/plan/derive';
import {
  type FlowDiagramOptions,
  diagramFocus,
  flowDiagram,
} from '@/application/plan-viz-flow-diagram';
import { ZoomPane } from '@/features/plan/viz/zoompane/zoom-pane.client';
import { Legend, type LegendItem } from '@/ui/legend';

import { FlowFigure } from './flow-figure';
import type { StepAction } from './flow-hit';
import { RestNote } from './flow-rest';

const KEY: readonly LegendItem[] = [
  { label: 'call', line: 'solid' },
  { label: 'event', line: 'dashed' },
  { label: 'data', line: 'dotted' },
];

export interface FlowPaneProps extends FlowDiagramOptions {
  readonly model: Model;
  readonly flowId: string;
  readonly action?: StepAction | undefined;
  /** Smallest scale a drawing too big to read whole opens at. */
  readonly readable?: number | undefined;
}

/** A flow's drawing in a zoom pane with its key, opened on the shown steps: for a page whose subject is the flow. */
export function FlowPane({ model, flowId, action, readable, ...options }: FlowPaneProps) {
  const data = flowDiagram(model, flowId, options);
  if (data === null) return null;
  return (
    <>
      <ZoomPane
        focus={diagramFocus(data)}
        h={data.h}
        legend={<Legend items={KEY} />}
        readable={readable}
        w={data.w}
        what="the flow"
      >
        <FlowFigure action={action} data={data} />
      </ZoomPane>
      <RestNote teams={data.rest} />
    </>
  );
}
