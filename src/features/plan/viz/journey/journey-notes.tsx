import type { Model } from '@/application/plan/derive';
import type { JourneyComparison as Comparison } from '@/application/plan/journey';
import { changeMarkers } from '@/application/plan-viz-flow-changes';
import { comparisonOf } from '@/application/plan-viz-journey-compare';
import { rolloutNotes } from '@/application/plan-viz-journey-outline';
import { journeyMarkerText, type JourneyMode, stepIn } from '@/application/plan-viz-journey-words';
import type { StepNode } from '@/domain/plan/plan-graph';
import { EntityChip } from '@/features/plan/common/entity-chip';
import { ModelText } from '@/features/plan/common/model-text';
import { PinAhead } from '@/features/plan/tray/pin-ahead.client';

import { JourneyComparison } from './journey-comparison';
import { JourneyMark } from './journey-mark';
import styles from './journey-notes.module.css';

export interface NotesProps {
  readonly model: Model;
  readonly comparison: Comparison;
  readonly stepId: string;
  readonly mode: JourneyMode;
  /** A change the page already gives as its headline. */
  readonly omitChange?: string | undefined;
}

const sourceNote = (n: number): string => {
  if (n === 0) return 'Recorded in the plan. No direct source is recorded for this step.';
  const are = n === 1 ? 'source is' : 'sources are';
  return `${String(n)} direct ${are} recorded for this step.`;
};

function StepEvidence({ model, step }: { readonly model: Model; readonly step: StepNode }) {
  return (
    <details className={styles.fold} data-keep="evidence">
      <summary>Evidence</summary>
      <p>{sourceNote(step.sources?.length ?? 0)}</p>
      {step.fails === undefined || step.fails === '' ? (
        <p>No failure behaviour is recorded for this step.</p>
      ) : null}
      <p>
        <EntityChip id={step.id} model={model} />
      </p>
    </details>
  );
}

function Rollout({ model, notes }: { readonly model: Model; readonly notes: readonly string[] }) {
  if (notes.length === 0) return null;
  return (
    <aside className={styles.rollout}>
      <strong>When this happens</strong>
      {notes.map((note) => (
        <ModelText key={note} model={model} text={note} />
      ))}
    </aside>
  );
}

interface AheadProps {
  readonly model: Model;
  readonly flowId: string;
  readonly stepId: string;
}

/** On today's walk, a ◇ for a step the plan revisits; reading it pins what changes to the tray. */
function Ahead({ model, flowId, stepId }: AheadProps) {
  const marks = changeMarkers(model, flowId);
  const ids = marks.pins[stepId] ?? [];
  if (ids.length === 0) return null;
  return <PinAhead ids={ids} reasons={marks.reasons[stepId] ?? []} />;
}

/**
 * What a journey adds under a step: a disclosure of how the plan changes it, what the plan says about retiring it,
 * and the evidence for the step itself.
 */
export function JourneyStepNotes({ model, comparison, stepId, mode, omitChange }: NotesProps) {
  const row = comparison.rows.find((r) => r.id === stepId) ?? null;
  const step = stepIn(row, mode);
  const marked = row !== null && journeyMarkerText(row, mode) !== '';
  const view = row === null ? null : comparisonOf(model, comparison, { row, mode, omitChange });
  const flat = view !== null && (view.kind === 'added' || view.kind === 'removed') && step !== null;
  return (
    <div className={styles.notes}>
      {marked && view !== null ? (
        <details className={styles.compare} data-keep="compare">
          <summary>
            <JourneyMark mode={mode} row={row} />
            <span>{flat ? 'Changes and decisions' : 'Compare'}</span>
          </summary>
          <JourneyComparison model={model} view={view} />
        </details>
      ) : null}
      {mode === 'asIs' ? <Ahead flowId={comparison.id} model={model} stepId={stepId} /> : null}
      <Rollout model={model} notes={rolloutNotes(model, comparison.id, stepId)} />
      {step === null ? null : <StepEvidence model={model} step={step} />}
    </div>
  );
}
