import type { Mark } from '@/application/plan-viz-waterfall-view';

import styles from './mark-tag.module.css';

/** What a layer did, in a small tag: it answered, missed, was never reached, or cannot keep the response. */
export function MarkTag({ mark }: { readonly mark: Mark }) {
  return (
    <span className={styles.tag} data-kind={mark.kind}>
      {mark.glyph === null ? null : (
        <span aria-hidden="true" className={styles.glyph}>
          {mark.glyph}
        </span>
      )}
      {mark.text}
    </span>
  );
}
