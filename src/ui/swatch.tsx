import styles from './swatch.module.css';

interface SwatchProps {
  /** Which of the team colours, 1 to 13; 0 draws a quiet grey. */
  readonly slot: number;
  /** Said to a screen reader; leave out when the name is printed beside it. */
  readonly label?: string;
}

// A small dot in a team's colour. The colour never carries the meaning alone: a name sits beside it or is read out.
export function Swatch({ slot, label }: SwatchProps) {
  return (
    <span
      aria-hidden={label === undefined ? true : undefined}
      aria-label={label}
      className={styles.swatch}
      data-slot={slot}
      role={label === undefined ? undefined : 'img'}
    />
  );
}
