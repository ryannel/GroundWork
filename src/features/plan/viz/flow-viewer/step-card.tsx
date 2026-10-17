import type { Model } from '@/application/plan/derive';
import type { Narration } from '@/application/plan-viz-flow-narration';
import { EntityChip } from '@/features/plan/common/entity-chip';
import { ModelText } from '@/features/plan/common/model-text';

import styles from './step-card.module.css';
import { StepMore } from './step-more';
import { StepRoute } from './step-route';
import { StepRows } from './step-rows';

export interface StepCardProps {
  readonly model: Model;
  readonly narration: Narration;
  readonly mode: 'asIs' | 'toBe';
  /** The changes that explain the stop; shown with their decisions when the plan is. */
  readonly changes?: readonly string[];
  readonly decisions?: readonly string[];
  /** The ◇ marks by step id, and why. */
  readonly marks?: Readonly<Record<string, string>> | undefined;
  readonly reasons?: Readonly<Record<string, readonly string[]>> | undefined;
}

function Changes({
  model,
  changes,
  decisions,
}: {
  readonly model: Model;
  readonly changes: readonly string[];
  readonly decisions: readonly string[];
}) {
  const [first, ...rest] = changes;
  if (first === undefined) return null;
  return (
    <div className={styles.changes}>
      <span className={styles.label}>Change</span>
      <EntityChip id={first} model={model} />
      {rest.length === 0 ? null : <span className={styles.label}>+{rest.length}</span>}
      {decisions.length === 0 ? null : <span className={styles.label}>Decision</span>}
      {decisions.map((d) => (
        <EntityChip id={d} key={d} model={model} />
      ))}
    </div>
  );
}

function Purges({ model, ids }: { readonly model: Model; readonly ids: readonly string[] }) {
  return (
    <div className={styles.changes}>
      <span className={styles.label}>Purges</span>
      {ids.map((p) => (
        <EntityChip id={p} key={p} model={model} />
      ))}
    </div>
  );
}

function Heading({
  narration,
  mark,
  why,
}: {
  readonly narration: StepCardProps['narration'];
  readonly mark: string | undefined;
  readonly why: string;
}) {
  return (
    <h3 className={styles.title}>
      <span className={styles.num}>
        {narration.group ? 'Steps' : 'Step'} {narration.number}
      </span>
      <span>{narration.text}</span>
      {mark === undefined ? null : (
        <span className={styles.mark} title={why}>
          {mark}
        </span>
      )}
    </h3>
  );
}

const NO_CHANGES: NonNullable<StepCardProps['changes']> = [];
const NO_DECISIONS: NonNullable<StepCardProps['decisions']> = [];

// The card for the stop the reader is on: what happens, between whom, what it touches, and how it can fail.
export function StepCard({
  model,
  narration,
  mode,
  changes = NO_CHANGES,
  decisions = NO_DECISIONS,
  marks,
  reasons,
}: StepCardProps) {
  const id = narration.first.id;
  return (
    <article aria-label="This step" className={styles.card}>
      <Heading mark={marks?.[id]} narration={narration} why={reasons?.[id]?.join('\n') ?? ''} />
      {mode === 'asIs' ? null : <Changes changes={changes} decisions={decisions} model={model} />}
      <StepRoute model={model} route={narration.route} vias={narration.vias} />
      {narration.sentence === '' ? null : (
        <div className={styles.sentence}>
          <ModelText model={model} text={narration.sentence} />
        </div>
      )}
      {narration.purges.length === 0 ? null : <Purges ids={narration.purges} model={model} />}
      {narration.rows.length === 0 ? null : (
        <StepRows marks={marks} model={model} reasons={reasons} rows={narration.rows} />
      )}
      <StepMore mode={mode} model={model} narration={narration} />
    </article>
  );
}
