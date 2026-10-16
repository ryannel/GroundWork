import type { Model } from '@/application/plan/derive';
import { FlowViewer } from '@/features/plan/viz/flow-viewer/flow-viewer';
import { InlineMarkdown } from '@/ui/markdown';

import styles from './today-flows.module.css';

interface TodayFlowProps {
  readonly model: Model;
  readonly id: string;
  /** Where the workspace's pictures are served from. */
  readonly base: string;
}

// One flow as it runs today: how it starts and ends, then the flow drawn on the system with the step it is at lit,
// or as a sequence of who calls whom, walked step by step.
export function TodayFlow({ model, id, base }: TodayFlowProps) {
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
