import { stopBeside, type Walk } from '@/application/plan-story-journey-walk';

import type { Place } from './use-walk';
import styles from './walk-nav.module.css';

interface NavProps {
  readonly walk: Walk;
  readonly place: Place;
  readonly onGo: (index: number) => void;
}

function labelOf(walk: Walk, place: Place, to: number): string {
  const here = walk.positions[place.index]?.flowId;
  const there = walk.positions[to]?.flowId ?? '';
  if (there !== here) return `Flow: ${walk.flows[there] ?? there}`;
  return walk.titles[place.mode][to] ?? '';
}

/** A walk through one flow is a flow; through several, a scenario. */
const whole = (walk: Walk): string => (Object.keys(walk.flows).length > 1 ? 'scenario' : 'flow');

function wordOf(walk: Walk, by: -1 | 1, end: boolean): string {
  if (by === 1) return end ? `End of this ${whole(walk)}` : 'Next →';
  return end ? `Start of this ${whole(walk)}` : '← Previous';
}

function Side({ walk, place, onGo, by }: NavProps & { readonly by: -1 | 1 }) {
  const to = stopBeside(walk, place, by);
  return (
    <button
      className={styles.move}
      data-by={by === 1 ? 'next' : 'previous'}
      disabled={to === null}
      onClick={() => {
        if (to !== null) onGo(to);
      }}
      type="button"
    >
      <span className={styles.word}>{wordOf(walk, by, to === null)}</span>
      {to === null ? null : <span className={styles.title}>{labelOf(walk, place, to)}</span>}
    </button>
  );
}

/** The step before and after this one across the whole scenario, crossing into the next flow at a flow's end. */
export function WalkNav(props: NavProps) {
  return (
    <nav aria-label={`Steps in this ${whole(props.walk)}`} className={styles.nav}>
      <Side {...props} by={-1} />
      <Side {...props} by={1} />
    </nav>
  );
}
