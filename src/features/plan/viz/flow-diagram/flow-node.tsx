import type { DrawnNode } from '@/application/plan-viz-flow-drawn';

import { FlowCard } from './flow-card';
import { FlowCylinder } from './flow-cylinder';
import { Flags } from './flow-flags';
import { Hit, type StepAction } from './flow-hit';
import styles from './flow-node.module.css';
import { FlowPipe } from './flow-pipe';

export interface FlowNodeProps {
  readonly node: DrawnNode;
  readonly action: StepAction;
}

function Body({ node, action }: FlowNodeProps) {
  const { body } = node;
  if (body.kind === 'service') return <FlowCard action={action} body={body} node={node} />;
  if (body.kind === 'topic') return <FlowPipe body={body} node={node} />;
  return <FlowCylinder body={body} node={node} />;
}

/** One system on the drawing, placed where the layout put it; picking it anywhere but a row opens it. */
export function FlowNode({ node, action }: FlowNodeProps) {
  return (
    <g
      className={styles.node}
      data-kind={node.kind}
      data-node={node.id}
      transform={`translate(${String(node.x)} ${String(node.y)})`}
    >
      <Hit h={node.h} inspect={node.id} label={node.name} w={node.w} x={0} y={0} />
      <Body action={action} node={node} />
      <Flags
        fresh={node.state === 'added' && node.kind !== 'service'}
        mark={node.mark}
        w={node.w}
      />
      <title>{node.name}</title>
    </g>
  );
}
