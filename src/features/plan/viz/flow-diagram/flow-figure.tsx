import type { FlowDiagramData } from '@/application/plan-viz-flow-drawn';

import { FlowEdges, FlowPorts } from './flow-edges';
import styles from './flow-figure.module.css';
import type { StepAction } from './flow-hit';
import { FlowLabels } from './flow-labels';
import { FlowNode } from './flow-node';

export interface FlowFigureProps {
  readonly data: FlowDiagramData;
  /** What picking a step does: `inspect` opens it, `go` hands its number to a viewer (`data-step`). */
  readonly action?: StepAction | undefined;
}

/** The drawing itself at its own size: arrows under the systems, the words on the arrows over them. */
export function FlowFigure({ data, action = 'inspect' }: FlowFigureProps) {
  return (
    <svg
      aria-label={`Flow diagram: ${data.name}, ${String(data.nodes.length)} systems`}
      className={styles.svg}
      data-flow={data.flowId}
      height={data.h}
      role="group"
      viewBox={`0 0 ${String(data.w)} ${String(data.h)}`}
      width={data.w}
    >
      <FlowEdges edges={data.edges} />
      <g>
        {data.nodes.map((n) => (
          <FlowNode key={n.id} action={action} node={n} />
        ))}
      </g>
      <FlowPorts ports={data.ports} />
      <FlowLabels action={action} labels={data.labels} />
    </svg>
  );
}
