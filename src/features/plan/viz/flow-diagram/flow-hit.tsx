import styles from './flow-hit.module.css';

/** What picking a step does: open it in the inspector, or hand its number to a viewer that goes there. */
export type StepAction = 'inspect' | 'go';

/** The hit props for a step, by what picking a step does. */
export function stepTarget(
  action: StepAction,
  step: number | null,
  ref: string,
): { inspect: string; step: number | undefined } {
  return { inspect: ref, step: action === 'go' && step !== null ? step : undefined };
}

export interface HitProps {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** What a screen reader says the target is. */
  readonly label: string;
  /** The thing the inspector opens. */
  readonly inspect?: string | undefined;
  /** The step a viewer goes to; wins over `inspect`. */
  readonly step?: number | undefined;
}

// A click target laid over part of the drawing. A real button, so it takes the keyboard and the inspector's
// [data-inspect] hook, which an svg element cannot carry.
export function Hit({ x, y, w, h, label, inspect, step }: HitProps) {
  return (
    <foreignObject height={h} pointerEvents="auto" width={w} x={x} y={y}>
      <button
        aria-label={label}
        className={styles.hit}
        data-inspect={step === undefined ? inspect : undefined}
        data-step={step}
        title={label}
        type="button"
      />
    </foreignObject>
  );
}
