import type { Model } from '@/application/plan/derive';
import { teamOf } from '@/application/plan-viz-teams';

import { EntityChip } from './entity-chip';
import styles from './service-chip.module.css';
import { TeamDot } from './team-dot';

interface ServiceChipProps {
  readonly model: Model;
  readonly id: string;
  /** The page's own subject: in the line, but not lit. */
  readonly quiet?: boolean;
  /** Fading, for a service the plan moves away. */
  readonly dim?: boolean;
}

/** A service (or any owned thing) as a chip led by its team's colour dot, never marked by status. */
export function ServiceChip({ model, id, quiet = false, dim = false }: ServiceChipProps) {
  const team = teamOf(model, id);
  return (
    <span
      className={styles.svc}
      data-dim={dim ? '' : undefined}
      data-quiet={quiet ? '' : undefined}
    >
      {team === null ? null : <TeamDot model={model} teamId={team} />}
      <EntityChip id={id} model={model} status="existing" />
    </span>
  );
}
