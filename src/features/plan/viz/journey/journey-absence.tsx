import type { ReactNode } from 'react';

import type { AbsenceView } from '@/application/plan-viz-journey-outline';
import { type JourneyMode, MODE_NAMES } from '@/application/plan-viz-journey-words';

import styles from './journey-absence.module.css';

interface AbsenceProps {
  readonly view: AbsenceView;
  /** Under the claim: what the plan says about the removal. */
  readonly extra?: ReactNode;
  readonly onStep: (stepId: string) => void;
  readonly onMode: (mode: JourneyMode) => void;
}

/** What to show where the chosen step, or the flow, is not in the view: say so, then point to where to go. */
export function JourneyAbsence({ view, extra, onStep, onMode }: AbsenceProps) {
  return (
    <section aria-live="polite" className={styles.absence} data-absent-step={view.stepId}>
      <h3>{view.claim}</h3>
      {view.title === null ? null : <p>{view.title}</p>}
      {view.noNeighbours ? (
        <p className={styles.muted}>
          No neighbouring step survives in this view; there is no recorded counterpart.
        </p>
      ) : null}
      {extra}
      <div className={styles.actions}>
        {view.steps.map((step) => (
          <button
            key={step.id}
            onClick={() => {
              onStep(step.id);
            }}
            type="button"
          >
            {step.label}
          </button>
        ))}
        {view.counterpart === null ? null : (
          <button
            onClick={() => {
              if (view.counterpart !== null) onMode(view.counterpart);
            }}
            type="button"
          >
            Show {MODE_NAMES[view.counterpart].toLowerCase()}
          </button>
        )}
      </div>
    </section>
  );
}
