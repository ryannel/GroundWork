import type { Model } from '@/application/plan/derive';
import type { ComparisonView, DetailView, Lead } from '@/application/plan-viz-journey-compare';
import { propLabel } from '@/application/plan-viz-journey-words';
import { EntityChip } from '@/features/plan/common/entity-chip';
import { ModelText } from '@/features/plan/common/model-text';

import { JourneyCells, JourneySide } from './journey-cells';
import styles from './journey-comparison.module.css';

interface PanelProps {
  readonly model: Model;
  readonly view: ComparisonView;
}

function LeadView({ model, lead }: { readonly model: Model; readonly lead: Lead }) {
  if (lead.kind === 'none') return null;
  if (lead.kind === 'cells') return <JourneyCells cells={lead.cells} model={model} />;
  if (lead.kind === 'absent') {
    return <JourneySide content={lead.content} mode={lead.mode} model={model} />;
  }
  return (
    <div>
      <p>This step still works with this plan.</p>
      {lead.reasons.map((why) => (
        <ModelText key={why} model={model} text={why} />
      ))}
    </div>
  );
}

function Details({
  model,
  details,
}: {
  readonly model: Model;
  readonly details: readonly DetailView[];
}) {
  if (details.length === 0) return null;
  return (
    <details className={styles.fold} data-keep="change-details">
      <summary>Change details</summary>
      {details.map((d) => (
        <div className={styles.item} key={`${d.target}|${d.property ?? ''}`}>
          <p>
            <EntityChip id={d.target} model={model} />
            <span>{propLabel(d.property)}</span>
            {d.indirect ? <span className={styles.muted}>· related data</span> : null}
          </p>
          <JourneyCells cells={d.cells} model={model} />
        </div>
      ))}
    </details>
  );
}

function Reasons({ model, view }: PanelProps) {
  if (view.changes.length === 0 && view.decisions.length === 0) return null;
  const chips = [...view.changes, ...view.decisions].map((id) => (
    <EntityChip id={id} key={id} model={model} />
  ));
  // A step the plan adds or removes carries its reasons openly; elsewhere they sit behind a fold.
  if ((view.kind === 'added' || view.kind === 'removed') && view.lead.kind !== 'absent') {
    return <div className={styles.reasons}>{chips}</div>;
  }
  return (
    <details className={styles.fold} data-keep="changes">
      <summary>Changes and their decisions</summary>
      <p className={styles.muted}>
        These changes affect this step or its linked data. Their decisions can cover other parts of
        the plan.
      </p>
      <div className={styles.reasons}>{chips}</div>
    </details>
  );
}

/** What the plan changes at one step: the principal difference, the rest behind a fold, and the changes and decisions behind it. */
export function JourneyComparison({ model, view }: PanelProps) {
  if (view.unchanged) return <p className={styles.unchanged}>This step runs as today.</p>;
  return (
    <section
      aria-label={`Comparison for ${view.name}`}
      className={styles.panel}
      data-kind={view.kind}
    >
      {view.heading === null ? null : (
        <div className={styles.heading}>
          <EntityChip id={view.heading} model={model} />
        </div>
      )}
      {view.note === null ? null : <p className={styles.note}>{view.note}</p>}
      <LeadView lead={view.lead} model={model} />
      <Details details={view.details} model={model} />
      <Reasons model={model} view={view} />
    </section>
  );
}
