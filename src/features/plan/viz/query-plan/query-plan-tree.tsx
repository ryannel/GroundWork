import type { Model } from '@/application/plan/derive';
import type { Fetch, QueryPlan } from '@/application/plan/federation-plan-types';
import {
  planFacts,
  planOf,
  roundsOf,
  selectionOf,
  type PlanMode,
} from '@/application/plan-viz-query-plan';
import { EntityChip } from '@/features/plan/common/entity-chip';
import { TeamTag } from '@/features/plan/common/team-dot';

import styles from './query-plan-tree.module.css';
import { Selection } from './selection';

interface QueryPlanTreeProps {
  readonly model: Model;
  /** The operation: gql:… */
  readonly opId: string;
  readonly mode?: PlanMode;
}

function Notes({ f }: { readonly f: Fetch }) {
  return (
    <>
      {f.intermediate ? (
        <span
          className={styles.note}
          title="The gateway asks this subgraph only to turn one key into another, so the next fetch can find the type"
        >
          key hop
        </span>
      ) : null}
      {f.nPlusOne ? (
        <span
          className={styles.note}
          data-warn=""
          title="Below a list, and this subgraph does not batch: one call for every item"
        >
          n calls, no batching
        </span>
      ) : null}
    </>
  );
}

function FetchNode({
  model,
  plan,
  f,
}: {
  readonly model: Model;
  readonly plan: QueryPlan;
  readonly f: Fetch;
}) {
  const nodes = selectionOf(plan, f);
  return (
    <li className={styles.fetch} data-fetch={f.id}>
      <div className={styles.line}>
        {f.kind === 'entity' && f.path !== '' ? (
          <>
            <span className={styles.kw}>Flatten</span> <code className={styles.path}>{f.path}</code>
            <span aria-hidden="true" className={styles.sep}>
              ·
            </span>
          </>
        ) : null}
        <span className={styles.kw}>Fetch</span>{' '}
        <EntityChip id={f.subgraph} model={model} status="existing" />
        {f.team === null ? null : <TeamTag model={model} teamId={f.team} />}
        <Notes f={f} />
      </div>
      {nodes.length === 0 ? null : (
        <code className={styles.sel}>
          <Selection nodes={nodes} />
        </code>
      )}
    </li>
  );
}

function Round({
  model,
  plan,
  round,
  title,
}: {
  readonly model: Model;
  readonly plan: QueryPlan;
  readonly round: readonly Fetch[];
  readonly title: string;
}) {
  const [only] = round;
  if (round.length === 1 && only !== undefined) {
    return <FetchNode f={only} model={model} plan={plan} />;
  }
  return (
    <li className={styles.group}>
      <span className={styles.kw} title={title}>
        Parallel
      </span>
      <ul className={styles.kids}>
        {round.map((f) => (
          <FetchNode f={f} key={f.id} model={model} plan={plan} />
        ))}
      </ul>
    </li>
  );
}

/**
 * The query plan of an operation as a tree: rounds of fetches in a Sequence, the fetches of one round in Parallel,
 * and a Flatten where a fetch folds into the result above it. Draws nothing when the document does not parse or no
 * fetch is derived.
 */
export function QueryPlanTree({ model, opId, mode = 'toBe' }: QueryPlanTreeProps) {
  const plan = planOf(model, opId, mode);
  if (plan === null) return null;
  const rounds = roundsOf(plan);
  const rows = rounds.map((round) => (
    <Round
      key={round.map((f) => f.id).join(',')}
      model={model}
      plan={plan}
      round={round}
      title="Asked at the same time"
    />
  ));
  return (
    <div className={styles.plan} data-facts={planFacts(model, opId, mode)} data-facts-of={opId}>
      <ul className={styles.top}>
        {rounds.length > 1 ? (
          <li className={styles.group}>
            <span className={styles.kw} title="One round trip after another">
              Sequence
            </span>
            <ul className={styles.kids}>{rows}</ul>
          </li>
        ) : (
          rows
        )}
      </ul>
    </div>
  );
}
