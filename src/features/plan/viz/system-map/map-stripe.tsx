import { isRinged } from '@/application/plan-viz-teams';

import styles from './map-stripe.module.css';

export interface MapStripeProps {
  readonly h: number;
  /** The corner radius of the card it runs down. */
  readonly r: number;
  readonly slot: number;
}

/** The team's colour down the left edge of a card; slots past eight carry a ring as well. */
export function MapStripe({ h, r, slot }: MapStripeProps) {
  const a = String(r + 0.5);
  const b = String(r + 5.5);
  const bottom = String(h - 0.5);
  const up = String(h - 0.5 - r);
  const arc = `A${String(r)} ${String(r)} 0 0 1`;
  return (
    <path
      className={styles.stripe}
      d={`M${a} 0.5 H${b} V${bottom} H${a} ${arc} 0.5 ${up} V${a} ${arc} ${a} 0.5 Z`}
      data-ring={isRinged(slot)}
      data-team={slot}
    />
  );
}
