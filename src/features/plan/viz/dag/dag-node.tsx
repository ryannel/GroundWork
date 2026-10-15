import type { DagNode } from '@/application/plan-viz-dag';
import { NODE_H, NODE_W } from '@/application/plan-viz-dag-layout';
import { STATE_GLYPH } from '@/application/plan-viz-work';
import { Hit } from '@/features/plan/viz/flow-diagram/flow-hit';

import styles from './dag-node.module.css';

const QUESTION = { size: 26, radius: 8, right: 12, up: 16, baseline: 12 };
const SHIFT = { none: 0, one: 22, many: 34 };

function shiftOf(count: number): number {
  if (count === 0) return SHIFT.none;
  return count === 1 ? SHIFT.one : SHIFT.many;
}

function Marks({ node }: { readonly node: DagNode }) {
  const { x, y, waits, late, state } = node;
  const right = x + NODE_W - QUESTION.right;
  const base = y + NODE_H - QUESTION.baseline;
  const many = waits.length > 1;
  const stateX = right - shiftOf(waits.length);
  const what = waits.length === 1 ? 'an open question' : `${String(waits.length)} open questions`;
  return (
    <>
      {waits.length === 0 ? null : (
        <g>
          <title>{`Waits on ${what}:\n${node.waitsText}`}</title>
          <circle
            className={styles.wait}
            cx={right - 7}
            cy={y + NODE_H - QUESTION.up}
            data-late={late ? '' : undefined}
            r={QUESTION.radius}
          />
          <text className={styles.mark} x={right - 7} y={base}>
            ?
          </text>
          {many ? (
            <text className={styles.count} x={right - 18} y={base}>
              {waits.length}
            </text>
          ) : null}
        </g>
      )}
      {state === null ? null : (
        <text className={styles.state} data-state={state} textAnchor="end" x={stateX} y={base}>
          {STATE_GLYPH[state]}
        </text>
      )}
    </>
  );
}

/** A work item as a card: its team's stripe, its title, the team, its size, and the marks for state and open questions. */
export function DagNodeView({ node }: { readonly node: DagNode }) {
  const { x, y } = node;
  const first = node.waits[0];
  return (
    <g
      className={styles.node}
      data-critical={node.critical ? '' : undefined}
      data-dim={node.dim ? '' : undefined}
      data-done={node.state === 'done' ? '' : undefined}
    >
      <rect className={styles.card} height={NODE_H} rx={8} width={NODE_W} x={x} y={y} />
      <rect
        className={styles.stripe}
        data-slot={node.slot}
        height={NODE_H - 20}
        rx={1.5}
        width={3}
        x={x}
        y={y + 10}
      />
      {node.lines.map((line, i) => (
        <text className={styles.title} key={line} x={x + 14} y={y + 20 + i * 18}>
          {line}
        </text>
      ))}
      <text className={styles.team} x={x + 14} y={y + NODE_H - 30}>
        {node.teamName}
      </text>
      <text className={styles.sub} x={x + 14} y={y + NODE_H - 12}>
        {node.sub}
      </text>
      <Marks node={node} />
      <Hit h={NODE_H} inspect={node.id} label={node.label} w={NODE_W} x={x} y={y} />
      {first === undefined ? null : (
        <Hit
          h={QUESTION.size}
          inspect={first}
          label={`Open ${first}`}
          w={QUESTION.size}
          x={x + NODE_W - QUESTION.right - QUESTION.size + 6}
          y={y + NODE_H - QUESTION.size - 3}
        />
      )}
    </g>
  );
}
