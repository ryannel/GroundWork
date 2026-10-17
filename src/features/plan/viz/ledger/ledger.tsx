import { Fragment, type ReactNode } from 'react';

import type { Model } from '@/application/plan/derive';
import {
  type GroupBy,
  type LedgerGroup,
  keepersOf,
  ledgerGroups,
} from '@/application/plan-viz-ledger';
import { KIND_VERB, kindsUsed } from '@/application/plan-viz-ledger-row';
import { teamName, teamOf } from '@/application/plan-viz-teams';
import { countOf } from '@/application/plan-viz-text';
import { TeamDot, TeamTag } from '@/features/plan/common/team-dot';
import { ForTeams, LensCount, LensTeams } from '@/features/plan/lens-cut.client';
import { Badge } from '@/ui/badge';
import { Legend } from '@/ui/legend';

import { LedgerRow } from './ledger-row';
import styles from './ledger.module.css';

const SWATCH = { add: 'add', modify: 'mod', deprecate: 'dep', remove: 'rem' } as const;

interface LedgerProps {
  readonly model: Model;
  readonly groupBy?: GroupBy;
  /** Cut to the team lens in the address: every row is drawn once and hidden from the teams it is not for. */
  readonly lensed?: boolean;
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

const NONE_OPEN: NonNullable<LedgerProps['open']> = [];

/** How many of the rows each team's lens keeps. */
function tally(rows: readonly (readonly string[])[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const team of rows.flat()) out[team] = (out[team] ?? 0) + 1;
  return out;
}

const ALL: (id: string) => readonly string[] = () => [];

/** Every change in the plan as one expandable row, grouped by the service or team that builds it. */
export function Ledger({
  model,
  groupBy = 'service',
  lensed = false,
  open = NONE_OPEN,
  legend = true,
}: LedgerProps) {
  const groups = ledgerGroups(model, { groupBy });
  const all = groups.flatMap((g) => g.rows.map((r) => r.id));
  if (groups.length === 0) return <div className={styles.empty}>No changes for this team.</div>;
  const teams = model.plan.teams.map((t) => t.id);
  const keepers = lensed ? keepersOf(model) : ALL;
  const cut = (ids: readonly string[], children: ReactNode, key?: string) =>
    lensed ? (
      <ForTeams key={key} teams={ids}>
        {children}
      </ForTeams>
    ) : (
      <Fragment key={key}>{children}</Fragment>
    );
  const kept = tally(all.map(keepers));
  return (
    <LensTeams teams={lensed ? teams : []}>
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
        {lensed ? (
          <ForTeams everyone={false} teams={teams.filter((t) => kept[t] === undefined)}>
            <div className={styles.empty}>No changes for this team.</div>
          </ForTeams>
        ) : null}
        {groups.map((g) => {
          const each = g.rows.map((r) => keepers(r.id));
          const counts = tally(each);
          return cut(
            Object.keys(counts),
            <section className={styles.group} data-group>
              {groupBy === 'none' ? null : (
                <header className={styles.head}>
                  <GroupHead group={g} groupBy={groupBy} model={model} />
                  <span className={styles.count}>
                    {lensed ? (
                      <LensCount
                        everyone={g.rows.length}
                        many="changes"
                        one="change"
                        teams={counts}
                      />
                    ) : (
                      countOf(g.rows.length, 'change')
                    )}
                  </span>
                </header>
              )}
              {g.rows.map((r, i) =>
                cut(
                  each[i] ?? [],
                  <LedgerRow model={model} open={open.includes(r.id)} row={r} />,
                  r.id,
                ),
              )}
            </section>,
            g.key ?? 'plan-wide',
          );
        })}
      </div>
    </LensTeams>
  );
}
