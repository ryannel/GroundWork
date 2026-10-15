import { SAT_LINE } from '@/application/plan-viz-system-map-boxes';
import type { DrawnNode } from '@/application/plan-viz-system-map-types';
import { Hit } from '@/features/plan/viz/flow-diagram/flow-hit';

import styles from './map-satellite.module.css';

const CAP = 6;
const TOPIC_X = 26;
const STORE_X = 10;
const STACK = 13;

function Pipe({ w, h }: { readonly w: number; readonly h: number }) {
  const mid = h / 2;
  const end = String(w - CAP);
  const arc = `A${String(CAP)} ${String(mid)} 0 0 1`;
  return (
    <>
      <path
        className={styles.shape}
        d={`M${String(CAP)} 0 H${end} ${arc} ${end} ${String(h)} H${String(CAP)} ${arc} ${String(CAP)} 0 Z`}
        data-kind="topic"
      />
      <ellipse className={styles.cap} cx={w - CAP} cy={mid} rx={CAP} ry={mid} />
      {[0, 6].map((d) => (
        <path
          key={d}
          className={styles.chevron}
          d={`M${String(10 + d)} ${String(mid - 4)} l4 4 l-4 4`}
        />
      ))}
    </>
  );
}

function Cylinder({ w, h }: { readonly w: number; readonly h: number }) {
  const half = w / 2;
  const arc = `A${String(half)} 4 0 0`;
  return (
    <>
      <path
        className={styles.shape}
        d={`M0 4 ${arc} 1 ${String(w)} 4 V${String(h - 4)} ${arc} 1 0 ${String(h - 4)} Z`}
        data-kind="store"
      />
      <ellipse className={styles.cap} cx={half} cy={4} rx={half} ry={4} />
    </>
  );
}

function Words({ node, x }: { readonly node: DrawnNode; readonly x: number }) {
  const dy = node.kind === 'topic' ? 0.5 : 2.5;
  const names = node.lines.length;
  const stacked = node.role.length > 0;
  return (
    <>
      {node.lines.map((t, i) => (
        <text
          key={t}
          className={styles.name}
          x={x}
          y={stacked ? node.top + i * SAT_LINE : node.h / 2 + dy + (i - (names - 1) / 2) * STACK}
        >
          {t}
        </text>
      ))}
      {node.role.map((t, i) => (
        <text key={t} className={styles.role} x={x} y={node.top + (names + i) * SAT_LINE}>
          {t}
        </text>
      ))}
    </>
  );
}

/** A topic (a pipe) or a store (a cylinder), hung under the service that keeps it. */
export function MapSatellite({ node }: { readonly node: DrawnNode }) {
  const topic = node.kind === 'topic';
  return (
    <>
      {topic ? <Pipe h={node.h} w={node.w} /> : <Cylinder h={node.h} w={node.w} />}
      <Words node={node} x={topic ? TOPIC_X : STORE_X} />
      <Hit h={node.h} inspect={node.id} label={node.name} w={node.w} x={0} y={0} />
    </>
  );
}
