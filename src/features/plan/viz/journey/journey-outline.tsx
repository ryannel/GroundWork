import type { OutlineItem } from '@/application/plan-viz-journey-outline';

import { JourneyMarkText } from './journey-mark';
import styles from './journey-outline.module.css';

interface OutlineProps {
  readonly items: readonly OutlineItem[];
  /** The step being looked at. */
  readonly current: string;
  readonly onPick: (stepId: string) => void;
}

/** The steps of the flow in recorded order, with the steps this view lacks where they would sit. */
export function JourneyOutline({ items, current, onPick }: OutlineProps) {
  const steps = items.filter((i) => i.kind === 'step');
  if (steps.length === 0) return null;
  const at = steps.findIndex((s) => s.id === current);
  return (
    <details className={styles.outline} data-keep="outline">
      <summary>
        Steps in this flow{' '}
        <span className={styles.count}>
          {at === -1 ? String(steps.length) : `${String(at + 1)} of ${String(steps.length)}`}
        </span>
      </summary>
      <p className={styles.hint}>
        Recorded order. Conditions determine which steps run; event-driven work can complete
        separately.
      </p>
      <ol className={styles.list}>
        {items.map((item) =>
          item.kind === 'gap' ? (
            <li className={styles.gap} key={`gap:${item.rows.map((r) => r.id).join('+')}`}>
              <span>{item.label}</span>
              {item.rows.map((row) => (
                <button
                  key={row.id}
                  onClick={() => {
                    onPick(row.id);
                  }}
                  type="button"
                >
                  {row.title}
                </button>
              ))}
            </li>
          ) : (
            <li data-current={item.id === current ? '' : undefined} key={item.id}>
              <button
                aria-current={item.id === current ? 'step' : undefined}
                className={styles.step}
                onClick={() => {
                  onPick(item.id);
                }}
                type="button"
              >
                <span className={styles.number}>{item.n}</span>
                {item.title}
                <JourneyMarkText kind={item.change} text={item.marker} />
              </button>
            </li>
          ),
        )}
      </ol>
    </details>
  );
}
