import type { ReactNode } from 'react';

import styles from './flow-card.module.css';
import { Glyph } from './icon';

/** How a mark looks while one is traced: the traced one, its neighbours, or the rest. */
export type FlowLit = 'on' | 'near' | 'off' | undefined;

/** Handlers that trace a card while the pointer or focus is on one of its parts. */
export interface FlowTrace {
  readonly onBlur: () => void;
  readonly onFocus: () => void;
  readonly onPointerEnter: () => void;
  readonly onPointerLeave: () => void;
}

/**
 * One stage of a flow: a title that links to its words, an optional note on where it lives, and what is in it.
 * It fills the box it is given; the heights are fixed so a layout can size it in advance: 8 above the title (20
 * high, 20 more for the note), 12 above the rows, 12 below.
 */
export function FlowCard({
  title,
  href,
  note,
  hub = false,
  lit,
  trace,
  children,
}: {
  /** Each line is kept as given, so the card keeps the height it was sized for. */
  readonly title: readonly string[];
  readonly href: string;
  readonly note?: string | null;
  /** Where lanes meet: drawn in the accent. */
  readonly hub?: boolean;
  readonly lit?: FlowLit;
  readonly trace?: FlowTrace;
  readonly children: ReactNode;
}) {
  const outside = note !== undefined && note !== null;
  return (
    <section
      aria-label={title.join(' ')}
      className={styles.card}
      data-hub={hub ? '' : undefined}
      data-lit={lit}
      data-outside={outside ? '' : undefined}
    >
      <a className={styles.title} href={href} {...trace}>
        {title.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </a>
      {outside ? <span className={styles.note}>{note}</span> : null}
      <ul className={styles.rows}>{children}</ul>
    </section>
  );
}

/** A thing in a flow card that opens in the inspector: its name broken into lines, and where it lives. */
export function FlowCardRow({
  glyph,
  lines,
  place = null,
  inspect,
  trace,
}: {
  readonly glyph: string;
  /** Each line is kept as given, so the card keeps the height it was sized for. */
  readonly lines: readonly string[];
  readonly place?: string | null;
  readonly inspect: string;
  readonly trace?: FlowTrace;
}) {
  return (
    <li>
      <button className={styles.row} data-inspect={inspect} type="button" {...trace}>
        <span aria-hidden="true" className={styles.glyph}>
          <Glyph glyph={glyph} />
        </span>
        <span className={styles.name}>
          {lines.map((line) => (
            <span key={line}>{line}</span>
          ))}
          {place === null ? null : <span className={styles.place}>{place}</span>}
        </span>
      </button>
    </li>
  );
}

export interface FlowLineIn {
  readonly key: string;
  readonly d: string;
  readonly lit?: FlowLit;
}

/** The lines between flow cards, each ending in an arrow. */
export function FlowLines({
  id,
  lines,
  size,
}: {
  /** Unique on the page, for the arrow. */
  readonly id: string;
  readonly lines: readonly FlowLineIn[];
  readonly size: { readonly w: number; readonly h: number };
}) {
  return (
    <svg aria-hidden="true" className={styles.lines} height={size.h} width={size.w}>
      <defs>
        <marker
          id={id}
          markerHeight={7}
          markerWidth={7}
          orient="auto"
          refX={7}
          refY={4}
          viewBox="0 0 8 8"
        >
          <path className={styles.head} d="M0,0 L8,4 L0,8 z" />
        </marker>
      </defs>
      {lines.map((line) => (
        <path
          className={styles.line}
          d={line.d}
          data-lit={line.lit}
          key={line.key}
          markerEnd={`url(#${id})`}
        />
      ))}
    </svg>
  );
}
