import type { Model } from '@/application/plan/derive';
import { provesWithoutWalking } from '@/application/plan-viz-tests';
import { NamedChip } from '@/features/plan/common/named-chip';

import styles from './honesty.module.css';

interface HonestyProps {
  readonly model: Model;
  /** A team id: only rows touching that team. */
  readonly lens?: string;
}

/**
 * The gap a green matrix hides: a test that claims a change but runs no step that change touches. Nothing when there is
 * none.
 */
export function Honesty({ model, lens }: HonestyProps) {
  const rows = provesWithoutWalking(model, lens);
  if (rows.length === 0) return null;
  return (
    <div className={styles.hz} role="note">
      <h4 className={styles.heading}>Tests that never run what they prove</h4>
      <ul className={styles.list}>
        {rows.map((g) => (
          <li className={styles.row} key={`${g.test}|${g.change}`}>
            <NamedChip id={g.test} model={model} />
            <span className={styles.says}>claims to prove</span>
            <NamedChip id={g.change} model={model} />
            <span className={styles.why}>but runs no step it touches</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
