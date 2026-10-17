import type { MapLine } from '@/application/landscape-domains-layout';

import type { Lit } from './landscape-box';
import styles from './landscape-lines.module.css';

interface LinesProps {
  /** Whether a lit line names what it carries; off while a whole journey is lit, as the names would crowd. */
  readonly labelled: boolean;
  readonly lines: readonly MapLine[];
  readonly lit: (id: string) => Lit;
  /** What a line carries, short, and in full for its tip. */
  readonly label: (id: string) => { readonly short: string; readonly full: string };
}

// The lines between the boxes: a call solid, an event dashed, a read or write dotted, a customer's use grey. A lit
// line names what it carries.
export function LandscapeLines({ labelled, lines, lit, label }: LinesProps) {
  return (
    <g className={styles.lines}>
      <defs>
        <marker
          id="land-arrow"
          markerHeight="8"
          markerWidth="8"
          orient="auto-start-reverse"
          refX="7"
          refY="4"
          viewBox="0 0 8 8"
        >
          <path className={styles.head} d="M0 0 L8 4 L0 8 z" />
        </marker>
      </defs>
      {lines.map((line) => {
        const words = label(line.id);
        return (
          <g className={styles.line} data-kind={line.kind} data-lit={lit(line.id)} key={line.id}>
            <path
              className={styles.path}
              d={line.d}
              markerEnd={line.arrows.end ? 'url(#land-arrow)' : undefined}
              markerStart={line.arrows.start ? 'url(#land-arrow)' : undefined}
            >
              <title>{words.full}</title>
            </path>
            {labelled && lit(line.id) === 'hot' && words.short !== '' ? (
              <text className={styles.label} x={line.mx} y={line.my}>
                {words.short}
              </text>
            ) : null}
          </g>
        );
      })}
    </g>
  );
}
