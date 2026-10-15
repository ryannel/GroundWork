import type { Model } from '@/application/plan/derive';
import { ROAM_GLOSS } from '@/application/plan-risk-words';
import { searchText } from '@/application/plan-story-ref';
import {
  bySeverity,
  handlingOf,
  isResolved,
  levelsText,
  numberOfRisk,
  riskFacts,
  risksOf,
  statementOf,
} from '@/application/plan-viz-risks';
import { teamName } from '@/application/plan-viz-teams';
import type { Risk } from '@/domain/plan/plan.generated';
import { NamedChip, NamedChips } from '@/features/plan/common/named-chip';
import { TeamTag } from '@/features/plan/common/team-dot';
import { NoneMark } from '@/features/plan/common/test-button';
import { DataTable } from '@/ui/data-table';

import styles from './risk-register.module.css';

interface RiskRegisterProps {
  readonly model: Model;
  readonly ids: readonly string[];
}

const COLUMNS = [
  { key: 'no', label: 'Risk' },
  { key: 'what', label: 'What could go wrong' },
  { key: 'levels', label: 'Likelihood × impact' },
  { key: 'status', label: 'Status' },
  { key: 'owner', label: 'Owner' },
  { key: 'about', label: 'About' },
  { key: 'accepted', label: 'Accepted with' },
];

function rowOf(model: Model, r: Risk) {
  return {
    key: r.id,
    search: searchText(
      statementOf(r),
      numberOfRisk(model, r),
      handlingOf(model, r),
      levelsText(r),
      r.owner === undefined ? '' : teamName(model, r.owner),
    ),
    cells: {
      no: (
        <button
          className={styles.number}
          data-facts={riskFacts(model, r)}
          data-inspect={r.id}
          type="button"
        >
          {numberOfRisk(model, r)}
        </button>
      ),
      what: (
        <button className={styles.statement} data-inspect={r.id} type="button">
          {statementOf(r)}
        </button>
      ),
      levels: levelsText(r),
      status: <span title={ROAM_GLOSS[r.roam ?? 'owned']}>{handlingOf(model, r)}</span>,
      owner: r.owner === undefined ? <NoneMark /> : <TeamTag model={model} teamId={r.owner} />,
      about: r.about === undefined ? <NoneMark /> : <NamedChips ids={r.about} model={model} />,
      accepted:
        r.accepted_by === undefined ? <NoneMark /> : <NamedChip id={r.accepted_by} model={model} />,
    },
  };
}

function Count({ n }: { readonly n: number }) {
  return <span className={styles.count}>{n}</span>;
}

/** Live risks by severity, resolved ones folded away last: number, statement, how likely and bad, handling, owner, about, accepted with. */
export function RiskRegister({ model, ids }: RiskRegisterProps) {
  const list = bySeverity(risksOf(model, ids));
  const live = list.filter((r) => !isResolved(r));
  const done = list.filter(isResolved);
  return (
    <div className={styles.register}>
      {live.length === 0 ? null : (
        <section data-group>
          <h3 className={styles.heading}>
            Open <Count n={live.length} />
          </h3>
          <DataTable
            caption="Open risks"
            columns={COLUMNS}
            rows={live.map((r) => rowOf(model, r))}
          />
        </section>
      )}
      {done.length === 0 ? null : (
        <details className={styles.fold} data-group>
          <summary className={styles.heading}>
            Resolved <Count n={done.length} />
          </summary>
          <DataTable
            caption="Resolved risks"
            columns={COLUMNS}
            rows={done.map((r) => rowOf(model, r))}
          />
        </details>
      )}
    </div>
  );
}
