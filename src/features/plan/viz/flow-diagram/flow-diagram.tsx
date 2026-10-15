import type { Model } from '@/application/plan/derive';
import { type FlowDiagramOptions, flowDiagram } from '@/application/plan-viz-flow-diagram';

import styles from './flow-diagram.module.css';
import { FlowFigure } from './flow-figure';
import type { StepAction } from './flow-hit';
import { RestNote } from './flow-rest';

export interface FlowDiagramProps extends FlowDiagramOptions {
  readonly model: Model;
  readonly flowId: string;
  /** What picking a step does; see `FlowFigure`. */
  readonly action?: StepAction | undefined;
  /** Fold a long list of teams outside the flow to its count. */
  readonly foldRest?: boolean | undefined;
}

/** A flow's systems and the calls, events and data between them, in a bordered frame that scrolls when it is wide. */
export function FlowDiagram({ model, flowId, action, foldRest, ...options }: FlowDiagramProps) {
  const data = flowDiagram(model, flowId, options);
  if (data === null) return null;
  return (
    <div className={styles.frame} data-lens={options.lens === undefined ? undefined : 'on'}>
      <FlowFigure action={action} data={data} />
      <RestNote fold={foldRest} teams={data.rest} />
    </div>
  );
}
