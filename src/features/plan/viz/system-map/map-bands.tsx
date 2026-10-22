import { clipText } from '@/application/plan-viz-flow-geometry';
import type { DrawnBand, DrawnOutside } from '@/application/plan-viz-system-map-types';
import { Hit } from '@/features/plan/viz/flow-diagram/flow-hit';

import styles from './map-bands.module.css';

export interface MapBandsProps {
  readonly bands: readonly DrawnBand[];
  readonly h: number;
}

/** The stages of the work, or the roles a domain's systems play, as columns behind the cards, each headed by its
 * name; a stage also by its number, and opens in the inspector. */
export function MapBands({ bands, h }: MapBandsProps) {
  return (
    <g>
      {bands.map((b) => (
        <g data-band={b.id} key={b.id}>
          <rect className={styles.band} height={h - 16} rx={10} width={b.w} x={b.x} y={8} />
          <text className={styles.head} x={b.x + 12} y={28}>
            {b.stage === null ? null : <tspan className={styles.number}>{b.stage + 1} </tspan>}
            {clipText(b.name, 22)}
            <title>{b.tip}</title>
          </text>
          {b.stage === null ? null : (
            <Hit h={24} inspect={b.id} label={b.tip} w={b.w} x={b.x} y={12} />
          )}
        </g>
      ))}
    </g>
  );
}

export interface MapOutsideProps {
  readonly outside: DrawnOutside | null;
  readonly w: number;
  readonly h: number;
}

/** The band of other domains' systems, in one panel beneath the domain's own, each domain named over its cards. */
export function MapOutside({ outside, w, h }: MapOutsideProps) {
  if (outside === null) return null;
  const top = outside.y - 14;
  return (
    <g data-outside="">
      <rect className={styles.band} height={h - top - 8} rx={10} width={w - 8} x={4} y={top} />
      <text className={styles.head} x={16} y={top + 20}>
        Other domains
      </text>
      {outside.heads.map((head) => (
        <text className={styles.head} key={`${head.name}@${String(head.x)}`} x={head.x} y={head.y}>
          {head.name}
        </text>
      ))}
    </g>
  );
}
