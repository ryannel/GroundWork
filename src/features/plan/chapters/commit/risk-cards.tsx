import type { Model } from '@/application/plan/derive';
import {
  handlingOf,
  isResolved,
  levelsText,
  numberOfRisk,
  riskFacts,
  statementOf,
} from '@/application/plan-viz-risks';
import type { Risk } from '@/domain/plan/plan.generated';
import { ModelInline } from '@/features/plan/common/model-text';
import { NamedChip, NamedChips } from '@/features/plan/common/named-chip';
import { TeamTag } from '@/features/plan/common/team-dot';

import styles from './risk-cards.module.css';

function RiskCard({ model, r }: { readonly model: Model; readonly r: Risk }) {
  const about = r.about ?? [];
  return (
    <article
      className={styles.card}
      data-facts={riskFacts(model, r)}
      data-resolved={isResolved(r) ? '' : undefined}
    >
      <h4 className={styles.head}>
        <button className={styles.title} data-inspect={r.id} type="button">
          <span className={styles.number}>{numberOfRisk(model, r)}</span>
          {statementOf(r)}
        </button>
      </h4>
      <p className={styles.meta}>
        <span>{levelsText(r)}</span>
        <span>{handlingOf(model, r)}</span>
        {r.owner === undefined ? null : <TeamTag model={model} teamId={r.owner} />}
      </p>
      {r.accepted_by === undefined ? null : (
        <div className={styles.row}>
          <span className={styles.key}>accepted with decision</span>
          <NamedChip id={r.accepted_by} model={model} />
        </div>
      )}
      {r.mitigation === undefined ? null : (
        <p className={styles.mitigation}>
          <span className={styles.key}>Mitigation</span>{' '}
          <ModelInline model={model} text={r.mitigation} />
        </p>
      )}
      {about.length === 0 ? null : (
        <div className={styles.row}>
          <span className={styles.key}>about</span>
          <NamedChips ids={about} model={model} />
        </div>
      )}
    </article>
  );
}

/** One card per risk, the biggest first, each with how it is handled, who owns it and what it is about. */
export function RiskCards({
  model,
  risks,
}: {
  readonly model: Model;
  readonly risks: readonly Risk[];
}) {
  return (
    <div className={styles.cards}>
      {risks.map((r) => (
        <RiskCard key={r.id} model={model} r={r} />
      ))}
    </div>
  );
}
