import type { JourneyRow } from '@/application/plan/journey';
import { journeyMarkerText, type JourneyMode } from '@/application/plan-viz-journey-words';

import styles from './journey-mark.module.css';

interface MarkProps {
  readonly row: JourneyRow | null | undefined;
  readonly mode: JourneyMode;
}

/** How the plan changes a step, in a few words; nothing when the step runs as today. */
export function JourneyMark({ row, mode }: MarkProps) {
  const text = journeyMarkerText(row, mode);
  if (row === null || row === undefined || text === '') return null;
  return (
    <span className={styles.mark} data-kind={row.kind}>
      {text}
    </span>
  );
}

interface TextMarkProps {
  readonly text: string;
  readonly kind: string;
}

/** The same mark, from words already chosen. */
export function JourneyMarkText({ text, kind }: TextMarkProps) {
  if (text === '') return null;
  return (
    <span className={styles.mark} data-kind={kind}>
      {text}
    </span>
  );
}
