import { Glyph } from './icon';
import styles from './legend.module.css';

export interface LegendItem {
  readonly label: string;
  readonly glyph?: string;
  readonly line?: 'solid' | 'dashed' | 'dotted';
  readonly swatch?: 'add' | 'mod' | 'dep' | 'rem' | 'dim' | 'cur' | 'out' | 'plain';
}

function Mark({ item }: { readonly item: LegendItem }) {
  if (item.line !== undefined)
    return <span aria-hidden="true" className={styles.line} data-line={item.line} />;
  if (item.swatch !== undefined)
    return <span aria-hidden="true" className={styles.swatch} data-swatch={item.swatch} />;
  if (item.glyph !== undefined)
    return (
      <span aria-hidden="true" className={styles.glyph}>
        <Glyph glyph={item.glyph} />
      </span>
    );
  return null;
}

// A strip that explains every glyph, line style and status colour where it appears.
export function Legend({
  items,
  title,
}: {
  readonly items: readonly LegendItem[];
  readonly title?: string;
}) {
  return (
    <div className={styles.legend} role="note">
      {title === undefined ? null : <span className={styles.title}>{title}</span>}
      {items.map((item) => (
        <span className={styles.item} key={item.label}>
          <Mark item={item} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

/** The legends the plan's drawings share. */
export const LEGENDS = {
  map: [
    { line: 'solid', label: 'sync call' },
    { line: 'dashed', label: 'event' },
    { line: 'dotted', label: 'data read or write' },
    { glyph: '□', label: 'internal step' },
    { glyph: '⛁', label: 'store' },
    { glyph: '⇶', label: 'topic' },
  ],
  sequence: [
    { line: 'solid', label: 'sync call' },
    { line: 'dashed', label: 'event' },
    { glyph: '□', label: 'internal step' },
    { glyph: '⛁', label: 'store' },
    { glyph: '◇', label: 'planned changes' },
    { swatch: 'cur', label: 'current step' },
  ],
  status: [
    { swatch: 'add', label: 'new' },
    { swatch: 'mod', label: 'changed' },
    { swatch: 'dep', label: 'deprecated' },
    { swatch: 'rem', label: 'removed' },
    { swatch: 'dim', label: 'unchanged (faded)' },
  ],
  types: [
    { glyph: '▣', label: 'service' },
    { glyph: '◧', label: 'UI' },
    { glyph: '⏱', label: 'job' },
    { glyph: '◇', label: 'external' },
    { glyph: '⛁', label: 'store' },
    { glyph: '⇄', label: 'endpoint' },
    { glyph: '⚡', label: 'event' },
    { glyph: '▤', label: 'schema' },
  ],
  graph: [
    { glyph: '⬢', label: 'graph' },
    { glyph: '⬡', label: 'subgraph' },
    { glyph: '⇄', label: 'operation' },
    { glyph: '⚿', label: 'key field' },
    { glyph: '🔒', label: 'private' },
    { glyph: '◍', label: 'cache' },
  ],
  walk: [
    { swatch: 'dim', label: 'walked' },
    { swatch: 'cur', label: 'you are here' },
    { line: 'dotted', label: 'to come' },
  ],
} as const satisfies Readonly<Record<string, readonly LegendItem[]>>;
