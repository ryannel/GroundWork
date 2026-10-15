import type { SeqGut } from '@/application/plan-viz-sequence-cells';

import styles from './seq-gutter.module.css';

/** The brackets of the tests that walk the flow, one lane each, as they cross one row. */
export function Gutter({ marks }: { readonly marks: readonly SeqGut[] }) {
  return (
    <div className={styles.gut}>
      {marks.map((m) => (
        <span
          className={styles.mark}
          data-lane={m.lane}
          data-level={m.level}
          data-pos={m.pos}
          key={m.n}
        >
          {m.pos === 'first' || m.pos === 'only' ? (
            <button
              aria-label={m.title}
              className={styles.badge}
              data-inspect={m.test}
              title={m.title}
              type="button"
            >
              {m.n}
            </button>
          ) : null}
        </span>
      ))}
    </div>
  );
}
