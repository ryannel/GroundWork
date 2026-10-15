import type { DrawnBand } from '@/application/plan-viz-system-map-types';

import styles from './map-stages.module.css';

// Room left of a stage when the map scrolls to it, in the map's own units.
const GAP = 8;

/** Scrolls the box the map sits in so the stage's column starts at its left edge. */
function scrollToStage(from: HTMLElement, id: string): void {
  const pane = from.closest('section');
  const band = pane?.querySelector(`[data-band="${CSS.escape(id)}"]`);
  const box = band?.closest<HTMLElement>('[data-scrolls]');
  if (band === undefined || band === null || box === null || box === undefined) return;
  const left = band.getBoundingClientRect().left - box.getBoundingClientRect().left;
  box.scrollTo({ left: box.scrollLeft + left - GAP, behavior: 'smooth' });
}

/** A button for each stage that scrolls the map to it, for a map wider than the page. */
export function MapStages({ bands }: { readonly bands: readonly DrawnBand[] }) {
  if (bands.length < 2) return null;
  return (
    <div aria-label="Stages: scroll the map to one" className={styles.stages} role="group">
      <span className={styles.label}>Stages</span>
      {bands.map((b) => (
        <button
          className={styles.stage}
          key={b.id}
          onClick={(e) => {
            scrollToStage(e.currentTarget, b.id);
          }}
          title={`Scroll the map to ${String(b.stage + 1)} ${b.name}`}
          type="button"
        >
          <span className={styles.number}>{b.stage + 1}</span>
          {b.name}
        </button>
      ))}
    </div>
  );
}
