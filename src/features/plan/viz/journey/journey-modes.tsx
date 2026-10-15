import { type JourneyMode, MODE_NAMES } from '@/application/plan-viz-journey-words';

import styles from './journey-modes.module.css';

interface ModesProps {
  readonly mode: JourneyMode;
  readonly onMode: (mode: JourneyMode) => void;
}

const MODES: readonly JourneyMode[] = ['asIs', 'toBe'];

/** Choose between the system today and the system with this plan. */
export function JourneyModes({ mode, onMode }: ModesProps) {
  return (
    <div className={styles.modes}>
      <div aria-label="Journey view" className={styles.group} role="group">
        {MODES.map((m) => (
          <button
            aria-pressed={m === mode}
            key={m}
            onClick={() => {
              onMode(m);
            }}
            type="button"
          >
            {MODE_NAMES[m]}
          </button>
        ))}
      </div>
      <p>
        {mode === 'asIs'
          ? 'Today is the system recorded before this plan.'
          : 'With this plan is the system after this version’s changes.'}
      </p>
    </div>
  );
}
