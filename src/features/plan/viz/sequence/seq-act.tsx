import type { SeqRec, SeqStep } from '@/application/plan-viz-sequence-cells';
import { ModelText } from '@/features/plan/common/model-text';
import { Chip } from '@/ui/chip';

import styles from './seq-act.module.css';
import type { SeqEnv } from './seq-env';

function Words({ env, step }: { readonly env: SeqEnv; readonly step: SeqStep }) {
  const text = step.action === '' ? step.id : step.action;
  if (env.action === 'go') {
    return (
      <button
        className={styles.action}
        data-status={step.status}
        data-step={step.index}
        type="button"
      >
        {text}
      </button>
    );
  }
  return (
    <button
      className={styles.action}
      data-inspect={step.id}
      data-status={step.status}
      type="button"
    >
      {text}
    </button>
  );
}

function Rec({ rec }: { readonly rec: SeqRec }) {
  return (
    <span className={styles.rec} data-verb={rec.verb} title={rec.title}>
      <Chip glyph="⛁" id={rec.id} label={rec.label} />
    </span>
  );
}

/** What a step says in words beside its arrow: the action, what changed about it, its logic and the records it touches. */
export function Act({ env, step }: { readonly env: SeqEnv; readonly step: SeqStep }) {
  return (
    <div className={styles.act}>
      <div className={styles.line}>
        <Words env={env} step={step} />
        {env.notes[step.id]}
        {step.pill === null ? null : (
          <span className={styles.pill} data-tone={step.pill.tone}>
            {step.pill.text}
          </span>
        )}
        {step.marker === null ? null : (
          <button
            className={styles.marker}
            data-pin={step.id}
            title={env.markerTitle}
            type="button"
          >
            {step.marker}
          </button>
        )}
      </div>
      {step.logic === '' ? null : (
        <div className={styles.logic}>
          <ModelText model={env.model} text={step.logic} />
        </div>
      )}
      {step.recs.length === 0 ? null : (
        <div className={styles.recs}>
          {step.recs.map((r) => (
            <Rec key={`${r.verb}:${r.id}`} rec={r} />
          ))}
        </div>
      )}
      {step.see === null ? null : (
        <div className={styles.see} title={`The person sees ${step.see.label}`}>
          <Chip glyph="◫" id={step.see.ref} label={step.see.label} />
        </div>
      )}
    </div>
  );
}
