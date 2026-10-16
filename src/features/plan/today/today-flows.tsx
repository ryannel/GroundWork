import type { Model } from '@/application/plan/derive';
import { flowSteps } from '@/application/plan/flow-steps';
import { countOf } from '@/application/plan-viz-text';
import { FlowViewer } from '@/features/plan/viz/flow-viewer/flow-viewer';
import { InlineMarkdown } from '@/ui/markdown';

import { FlowChooser } from './flow-chooser.client';
import styles from './today-flows.module.css';

interface TodayFlowsProps {
  readonly model: Model;
  /** The flows to draw, by id, in the order to read them. */
  readonly flows: readonly string[];
  /** Where the workspace's pictures are served from. */
  readonly base: string;
}

function Flow({
  model,
  id,
  base,
}: {
  readonly model: Model;
  readonly id: string;
  readonly base: string;
}) {
  const node = model.asIs.get(id);
  if (node?.$type !== 'flow') return null;
  return (
    <div className={styles.flow}>
      {node.trigger === undefined && node.outcome === undefined ? null : (
        <p className={styles.ends}>
          {node.trigger === undefined ? null : (
            <span>
              <strong>Starts when</strong> <InlineMarkdown text={node.trigger} />
            </span>
          )}
          {node.outcome === undefined ? null : (
            <span>
              <strong>Ends with</strong> <InlineMarkdown text={node.outcome} />
            </span>
          )}
        </p>
      )}
      <FlowViewer
        keep="flow-view"
        base={base}
        compact
        flowId={id}
        markers={false}
        mode="asIs"
        model={model}
      />
    </div>
  );
}

// The flows that run through a system, one at a time: the flow drawn on the system with the step it is at lit, or
// as a sequence of who calls whom, walked step by step.
export function TodayFlows({ model, flows, base }: TodayFlowsProps) {
  const drawn = flows.flatMap((id) => {
    const node = model.asIs.get(id);
    if (node?.$type !== 'flow') return [];
    return [
      {
        id,
        name: node.name,
        says: countOf(flowSteps(model, id, 'asIs').length, 'step'),
        body: <Flow base={base} id={id} model={model} />,
      },
    ];
  });
  if (drawn.length === 0) return null;
  return <FlowChooser flows={drawn} />;
}
