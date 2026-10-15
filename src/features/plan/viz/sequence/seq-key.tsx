import type { SeqKey } from '@/application/plan-viz-sequence';
import { Chip } from '@/ui/chip';

import styles from './seq-key.module.css';

/** The tests whose brackets run down the left, numbered as the brackets are. */
export function Key({ items }: { readonly items: readonly SeqKey[] }) {
  if (items.length === 0) return null;
  return (
    <ol aria-label="Tests that walk this flow" className={styles.key}>
      {items.map((k) => (
        <li className={styles.item} key={k.n} title={k.title}>
          <span aria-hidden="true" className={styles.n}>
            {k.n}
          </span>
          <Chip glyph="✓" id={k.test} label={k.label} />
          <span className={styles.level}>{k.title}</span>
        </li>
      ))}
    </ol>
  );
}
