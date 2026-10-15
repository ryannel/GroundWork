import type { Model } from '@/application/plan/derive';
import type { TeamsView } from '@/application/plan-story-versions-teams';

import styles from './teams-block.module.css';
import { TeamName, WorkRows } from './work-rows';

/** The work a revision moves, team by team, and what it costs in one line. */
export function TeamsBlock({ model, view }: { readonly model: Model; readonly view: TeamsView }) {
  const { cost, teams, none } = view;
  if (cost === null && teams.length === 0 && none === null) {
    return <p className={styles.quiet}>No work items move.</p>;
  }
  return (
    <div className={styles.block}>
      {cost === null ? null : (
        <p className={styles.cost}>
          <b>{cost.lead}</b>
          {cost.when}
        </p>
      )}
      {teams.map((t) => (
        <div className={styles.team} key={t.id}>
          <div className={styles.who}>
            <TeamName id={t.id} model={model} name={t.name} />
            {t.role === null ? null : (
              <span className={styles.role} data-tell={t.role.tell ? '' : undefined}>
                {t.role.text}
              </span>
            )}
          </div>
          <WorkRows model={model} rows={t.work} />
        </div>
      ))}
      {none === null ? null : <p className={styles.quiet}>{none}</p>}
    </div>
  );
}
