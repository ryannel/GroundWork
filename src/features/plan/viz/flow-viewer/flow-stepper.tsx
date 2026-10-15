import styles from './flow-stepper.module.css';

export interface StepperStop {
  /** Unique among the stops. */
  readonly key: string;
  readonly title: string;
  /** The stop carries a ◇. */
  readonly marked?: boolean;
}

interface StepperProps {
  readonly stops: readonly StepperStop[];
  readonly current: number;
  readonly onGo: (stop: number) => void;
}

function stateOf(i: number, current: number): 'walked' | 'current' | 'ahead' {
  if (i === current) return 'current';
  return i < current ? 'walked' : 'ahead';
}

// Back, forward and a dot for every stop; the dots before the current one read as walked.
export function FlowStepper({ stops, current, onGo }: StepperProps) {
  return (
    <nav aria-label="Stops in this flow" className={styles.stepper}>
      <button
        className={styles.arrow}
        disabled={current <= 0}
        onClick={() => {
          onGo(current - 1);
        }}
        type="button"
      >
        ← Back
      </button>
      <ol className={styles.dots}>
        {stops.map((stop, i) => (
          <li key={stop.key}>
            <button
              aria-current={i === current ? 'step' : undefined}
              aria-label={`Stop ${String(i + 1)} of ${String(stops.length)}: ${stop.title}`}
              className={styles.dot}
              data-marked={stop.marked === true ? '' : undefined}
              data-state={stateOf(i, current)}
              onClick={() => {
                onGo(i);
              }}
              title={stop.title}
              type="button"
            />
          </li>
        ))}
      </ol>
      <button
        className={styles.arrow}
        disabled={current >= stops.length - 1}
        onClick={() => {
          onGo(current + 1);
        }}
        type="button"
      >
        Next →
      </button>
    </nav>
  );
}
