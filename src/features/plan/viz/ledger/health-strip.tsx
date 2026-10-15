import type { Model } from '@/application/plan/derive';
import { type HealthKey, healthTiles } from '@/application/plan-viz-ledger';
import { EntityChip } from '@/features/plan/common/entity-chip';

import styles from './health-strip.module.css';

interface HealthStripProps {
  readonly model: Model;
  /** Which tiles, in this order; all seven by default. */
  readonly keys?: readonly HealthKey[];
}

/** The plan's health in counts: each with its label spelled out and a line on what it means. */
export function HealthStrip({ model, keys }: HealthStripProps) {
  return (
    <ul aria-label="Plan health" className={styles.strip}>
      {healthTiles(model, keys).map((t) => (
        <li className={styles.tile} data-tone={t.tone} key={t.key} title={t.sub}>
          <span className={styles.value}>{t.value}</span>
          <span className={styles.label}>{t.label}</span>
          <span className={styles.sub}>{t.sub}</span>
          {t.ids.length > 0 ? (
            <span className={styles.ids}>
              {t.ids.map((id) => (
                <EntityChip id={id} key={id} model={model} status="existing" />
              ))}
              {t.moreIds > 0 ? <span className={styles.sub}>+{t.moreIds} more</span> : null}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
