import type { DrawnNode, TopicBody } from '@/application/plan-viz-flow-drawn';
import { PIPE_CAP, PIPE_IN } from '@/application/plan-viz-flow-size';

import { shapeData } from './flow-flags';
import { FlowGlyph } from './flow-glyph';
import { Hit } from './flow-hit';
import styles from './flow-pipe.module.css';

const NAME_LINE = 14;
const CHEVRONS = [0, 7, 14];
const EVENT_ROW = 16;

export interface FlowPipeProps {
  readonly node: DrawnNode;
  readonly body: TopicBody;
}

/** A topic or queue: a pipe with its name inside, and the events it carries listed underneath. */
export function FlowPipe({ node, body }: FlowPipeProps) {
  const { w } = node;
  const { ph } = body;
  const mid = ph / 2;
  const first = mid - ((body.nameLines.length - 1) * NAME_LINE) / 2 + 4;
  const shape = shapeData(node);
  return (
    <>
      <path
        className={styles.pipe}
        d={`M${String(PIPE_CAP)} 0 H${String(w - PIPE_CAP)} A${String(PIPE_CAP)} ${String(mid)} 0 0 1 ${String(w - PIPE_CAP)} ${String(ph)} H${String(PIPE_CAP)} A${String(PIPE_CAP)} ${String(mid)} 0 0 1 ${String(PIPE_CAP)} 0 Z`}
        {...shape}
      />
      <ellipse
        className={styles.cap}
        cx={w - PIPE_CAP}
        cy={mid}
        rx={PIPE_CAP}
        ry={mid}
        {...shape}
      />
      {CHEVRONS.map((d) => (
        <path
          key={d}
          className={styles.chevron}
          d={`M${String(PIPE_CAP + 10 + d)} ${String(mid - 5)} l5 5 l-5 5`}
          {...shape}
        />
      ))}
      {body.nameLines.map((line, k) => (
        <text
          key={line}
          className={styles.name}
          x={(PIPE_IN + w - 2 * PIPE_CAP) / 2}
          y={first + k * NAME_LINE}
        >
          {line}
        </text>
      ))}
      {body.events.map((ev) => (
        <g key={ev.id} className={styles.event} data-added={ev.added}>
          <FlowGlyph glyph="⚡" x={ev.iconX} y={ev.y - 6} />
          <text className={styles.eventText} x={ev.textX} y={ev.y + 2}>
            {ev.text}
          </text>
          <title>{ev.title}</title>
          <Hit
            h={EVENT_ROW}
            inspect={ev.id}
            label={`Event: ${ev.title}`}
            w={w}
            x={0}
            y={ev.y - EVENT_ROW / 2 - 2}
          />
        </g>
      ))}
    </>
  );
}
