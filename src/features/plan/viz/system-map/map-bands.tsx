import { clipText } from '@/application/plan-viz-flow-geometry';
import { CW } from '@/application/plan-viz-system-map-boxes';
import type { DrawnBand } from '@/application/plan-viz-system-map-types';
import { Hit } from '@/features/plan/viz/flow-diagram/flow-hit';

import styles from './map-bands.module.css';

const WIDTH = CW + 20;

export interface MapBandsProps {
  readonly bands: readonly DrawnBand[];
  readonly h: number;
}

/** The stages of the work as columns behind the cards, each headed by its number and name. */
export function MapBands({ bands, h }: MapBandsProps) {
  return (
    <g>
      {bands.map((b) => (
        <g data-band={b.id} key={b.id}>
          <rect className={styles.band} height={h - 16} rx={10} width={WIDTH} x={b.x} y={8} />
          <text className={styles.head} x={b.x + 12} y={28}>
            <tspan className={styles.number}>{b.stage + 1}</tspan>
            {` ${clipText(b.name, 22)}`}
            <title>{b.tip}</title>
          </text>
          <Hit h={24} inspect={b.id} label={b.tip} w={WIDTH} x={b.x} y={12} />
        </g>
      ))}
    </g>
  );
}
