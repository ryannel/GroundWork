import type { Model } from '@/application/plan/derive';
import type { TeamRow } from '@/application/plan-story-today-types';
import { EntityChip } from '@/features/plan/common/entity-chip';
import { TeamDot } from '@/features/plan/common/team-dot';

import styles from './team-strip.module.css';

interface TeamStripProps {
  readonly model: Model;
  readonly rows: readonly TeamRow[];
  readonly idle: readonly string[];
}

// Who runs what, a team to a row: its colour, how many systems, the systems themselves, and where to reach it.
export function TeamStrip({ model, rows, idle }: TeamStripProps) {
  return (
    <ul className={styles.teams}>
      {rows.map((row) => (
        <li className={styles.team} key={row.team}>
          <span className={styles.name}>
            <TeamDot model={model} named teamId={row.team} />
            <EntityChip id={row.team} model={model} />
          </span>
          <span className={styles.count}>{row.count}</span>
          <span className={styles.systems}>
            {row.services.map((id) => (
              <EntityChip id={id} key={id} model={model} />
            ))}
          </span>
          <span className={styles.channel}>{row.channel}</span>
        </li>
      ))}
      {idle.length === 0 ? null : (
        <li className={styles.idle}>
          <span className={styles.count}>Also involved, no services today</span>
          <span className={styles.systems}>
            {idle.map((id) => (
              <EntityChip id={id} key={id} model={model} />
            ))}
          </span>
        </li>
      )}
    </ul>
  );
}
