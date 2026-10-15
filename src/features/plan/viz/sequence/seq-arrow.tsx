import type { SeqArrow, SeqSelf } from '@/application/plan-viz-sequence-cells';
import { Chip } from '@/ui/chip';

import styles from './seq-arrow.module.css';
import { LaneItem } from './seq-lanes';

/** An arrow between two lifelines with what it carries written above it; the label opens that in the inspector. */
export function ArrowLane({ arrow }: { readonly arrow: SeqArrow }) {
  const { label, ref, title } = arrow;
  return (
    <LaneItem align="end" place={arrow.place}>
      <span
        className={styles.arrow}
        data-kind={arrow.kind}
        data-rev={arrow.rev ? '' : undefined}
        data-to-left={arrow.toLeft ? '' : undefined}
      >
        {label === '' ? null : (
          <span className={styles.label}>
            {ref === '' ? (
              label
            ) : (
              <button className={styles.ref} data-inspect={ref} title={title} type="button">
                {label}
              </button>
            )}
          </span>
        )}
        <span aria-hidden="true" className={styles.line} />
      </span>
    </LaneItem>
  );
}

/** A step that stays inside one service: a small box on its lifeline, and the stores it touches beside it. */
export function SelfLane({ self }: { readonly self: SeqSelf }) {
  return (
    <LaneItem align="end" place={self.place}>
      <span className={styles.self} data-left={self.left ? '' : undefined}>
        <span className={styles.box} title="Happens inside one service">
          □
        </span>
        {self.stores.map((s) => (
          <Chip glyph="⛁" id={s.id} key={s.id} label={s.label} />
        ))}
      </span>
    </LaneItem>
  );
}
