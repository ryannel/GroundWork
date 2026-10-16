import type { LandLine } from '@/application/landscape-map-types';

import type { Lit } from './landscape-box';
import styles from './landscape-lines.module.css';

const KIND_WORD = { use: 'uses', api: 'calls', msg: 'events', data: 'reads and writes' } as const;

/** What a line says when you rest on it: "Website to Order to delivery: calls, events. WMS REST and …". */
function tipOf(line: LandLine, name: (id: string) => string): string {
  const ends = `${name(line.a)} ${line.forward && line.back ? 'and' : 'to'} ${name(line.b)}`;
  const kinds = line.kinds.map((k) => KIND_WORD[k]).join(', ');
  const via = line.label === '' ? '' : `. ${line.label}`;
  return `${ends}: ${kinds}${via}`;
}

const CHAR = 6.5;

/** The label cut to the room its stretch of line has, or nothing if even a short one would not fit. */
function fitted(line: LandLine): string {
  const fits = Math.floor(line.room / CHAR);
  if (line.label.length <= fits) return line.label;
  return fits < 8 ? '' : `${line.label.slice(0, fits - 1).trimEnd()}…`;
}

interface LinesProps {
  /** Whether a lit line names what it carries; off while a whole journey is lit, as the names would crowd. */
  readonly labelled: boolean;
  readonly lines: readonly LandLine[];
  readonly lit: (id: string) => Lit;
  readonly name: (id: string) => string;
}

// The rolled-up connections: a call solid, an event dashed, a read or write dotted. A line lit by resting on it
// or its box names what it carries.
export function LandscapeLines({ labelled, lines, lit, name }: LinesProps) {
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
      {lines.map((line) => (
        <g className={styles.line} data-kind={line.kind} data-lit={lit(line.id)} key={line.id}>
          <path
            className={styles.path}
            d={line.d}
            markerEnd={line.forward ? 'url(#land-arrow)' : undefined}
            markerStart={line.back ? 'url(#land-arrow)' : undefined}
          >
            <title>{tipOf(line, name)}</title>
          </path>
          {labelled && lit(line.id) === 'hot' && fitted(line) !== '' ? (
            <text className={styles.label} x={line.mx} y={line.my}>
              {fitted(line)}
            </text>
          ) : null}
        </g>
      ))}
    </g>
  );
}
