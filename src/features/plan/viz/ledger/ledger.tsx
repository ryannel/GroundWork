import type { Model } from '@/application/plan/derive';
import { type GroupBy, type LedgerGroup, ledgerGroups } from '@/application/plan-viz-ledger';
import { KIND_VERB, kindsUsed } from '@/application/plan-viz-ledger-row';
import { teamName, teamOf } from '@/application/plan-viz-teams';
import { countOf } from '@/application/plan-viz-text';
import { TeamDot, TeamTag } from '@/features/plan/common/team-dot';
import { Badge } from '@/ui/badge';
import { Legend } from '@/ui/legend';

import { LedgerRow } from './ledger-row';
import styles from './ledger.module.css';

const SWATCH = { add: 'add', modify: 'mod', deprecate: 'dep', remove: 'rem' } as const;

interface LedgerProps {
  readonly model: Model;
  readonly groupBy?: GroupBy;
  /** Keep one team's changes. */
  readonly lens?: string | null;
  /** Change ids whose rows start open. */
  readonly open?: readonly string[];
  /** The key above the rows. */
  readonly legend?: boolean;
}

function GroupHead({
  model,
  group,
  groupBy,
}: {
  readonly model: Model;
  readonly group: LedgerGroup;
  readonly groupBy: GroupBy;
}) {
  const { key } = group;
  if (key === null) return <span className={styles.name}>Plan-wide</span>;
  if (groupBy === 'team') return <TeamTag model={model} teamId={key} />;
  const team = teamOf(model, key);
  return (
    <>
      {team === null ? null : <TeamDot model={model} teamId={team} />}
      <button className={styles.name} data-inspect={key} type="button">
        {model.label(key)}
      </button>
      {model.status(key) === 'added' ? <Badge tone="added">+ New</Badge> : null}
      {team === null ? null : <span className={styles.quiet}>{teamName(model, team)}</span>}
    </>
  );
}

/** Every change in the plan as one expandable row, grouped by the service or team that builds it. */
export function Ledger({
  model,
  groupBy = 'service',
  lens = null,
  open = [],
  legend = true,
}: LedgerProps) {
  const groups = ledgerGroups(model, { groupBy, lens });
  const all = groups.flatMap((g) => g.rows.map((r) => r.id));
  if (groups.length === 0) return <div className={styles.empty}>No changes for this team.</div>;
  return (
    <div className={styles.ledger}>
      {legend ? (
        <Legend
          items={[
            ...kindsUsed(model, all).map((k) => ({ label: KIND_VERB[k], swatch: SWATCH[k] })),
            { label: 'open a row for details' },
          ]}
          title="Key"
        />
      ) : null}
      {groups.map((g) => (
        <section className={styles.group} data-group key={g.key ?? 'plan-wide'}>
          {groupBy === 'none' ? null : (
            <header className={styles.head}>
              <GroupHead group={g} groupBy={groupBy} model={model} />
              <span className={styles.count}>{countOf(g.rows.length, 'change')}</span>
            </header>
          )}
          {g.rows.map((r) => (
            <LedgerRow key={r.id} model={model} open={open.includes(r.id)} row={r} />
          ))}
        </section>
      ))}
    </div>
  );
}
