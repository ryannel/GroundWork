import type { SystemNav } from '@/application/plan-viz-experience';

import styles from './system-stepper.module.css';

interface StepperProps {
  readonly prev: SystemNav | null;
  readonly next: SystemNav | null;
}

// Back and forward through the system steps of a moment.
export function SystemStepper({ prev, next }: StepperProps) {
  if (prev === null && next === null) return null;
  return (
    <div className={styles.stepper}>
      {prev === null ? (
        <span />
      ) : (
        <button
          aria-label={`Previous system step: ${prev.title}`}
          className={styles.button}
          data-step={prev.stop}
          type="button"
        >
          ← Previous system step
        </button>
      )}
      {next === null ? null : (
        <button
          aria-label={`Next system step: ${next.title}`}
          className={styles.button}
          data-step={next.stop}
          type="button"
        >
          Next system step →
        </button>
      )}
    </div>
  );
}
