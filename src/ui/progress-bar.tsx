import styles from './progress-bar.module.css';

interface ProgressBarProps {
  readonly label: string;
  readonly value: number;
  readonly max: number;
}

/** How far along something is, as a thin bar. */
export function ProgressBar({ label, value, max }: ProgressBarProps) {
  return <progress aria-label={label} className={styles.bar} max={max} value={value} />;
}
