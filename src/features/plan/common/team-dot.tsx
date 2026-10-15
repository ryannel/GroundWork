import type { Model } from '@/application/plan/derive';
import { isRinged, teamIndex, teamName } from '@/application/plan-viz-teams';

import styles from './team-dot.module.css';

interface TeamDotProps {
  readonly model: Model;
  readonly teamId: string;
  /** The name is printed right beside the dot, so the dot need not say it. */
  readonly named?: boolean;
}

/** A team's colour dot. It always names its team to a screen reader, as the dot is often the only mark. */
export function TeamDot({ model, teamId, named = false }: TeamDotProps) {
  const slot = teamIndex(model, teamId);
  const name = teamName(model, teamId);
  return (
    <span
      className={styles.dot}
      data-ring={isRinged(slot) ? '' : undefined}
      data-slot={slot}
      title={name}
    >
      {named ? null : <span className={styles.name}>{name}</span>}
    </span>
  );
}

/** The dot and the team's name, clickable: opens the team in the inspector. */
export function TeamTag({ model, teamId }: Omit<TeamDotProps, 'named'>) {
  return (
    <button className={styles.tag} data-inspect={teamId} type="button">
      <TeamDot model={model} named teamId={teamId} />
      {teamName(model, teamId)}
    </button>
  );
}
