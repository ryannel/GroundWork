import type { Model } from '@/application/plan/derive';
import { PLANNED, testInfo } from '@/application/plan-viz-tests';
import { Glyph } from '@/ui/icon';

import styles from './test-button.module.css';

interface TestButtonProps {
  readonly model: Model;
  readonly id: string;
  /** Print the level too (outside a matrix whose columns already say it). */
  readonly level?: boolean;
}

/** A planned test: a hollow ○ and its name; the id and where it runs are in the hover line. Opens the test in the inspector. */
export function TestButton({ model, id, level = false }: TestButtonProps) {
  const info = testInfo(model, id);
  return (
    <button
      aria-label={info.label}
      className={styles.test}
      data-inspect={id}
      data-planned=""
      title={info.tip}
      type="button"
    >
      <span aria-hidden="true" className={styles.glyph}>
        <Glyph glyph={PLANNED} />
      </span>
      {level && info.level !== '' ? <span className={styles.level}>{info.level}</span> : null}
      <span>{info.name}</span>
    </button>
  );
}

/** The faint mark for "nothing here": the same dot in every matrix. */
export function NoneMark({ title }: { readonly title?: string }) {
  return (
    <span className={styles.none} title={title}>
      <span aria-hidden="true">·</span>
      <span className={styles.sr}>none</span>
    </span>
  );
}
