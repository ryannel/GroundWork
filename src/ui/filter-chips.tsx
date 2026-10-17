import styles from './filter-chips.module.css';

export interface FilterChoice<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly count?: number;
}

interface FilterChipsProps<T extends string> {
  readonly label: string;
  readonly value: T;
  readonly choices: readonly FilterChoice<T>[];
  readonly onChange: (value: T) => void;
}

/** A row of pills to cut a list by one facet, each with how many it would leave; one is always pressed. */
export function FilterChips<T extends string>({
  label,
  value,
  choices,
  onChange,
}: FilterChipsProps<T>) {
  return (
    <div aria-label={label} className={styles.chips} role="group">
      {choices.map((c) => (
        <button
          aria-pressed={c.value === value}
          className={styles.chip}
          key={c.value}
          onClick={() => {
            onChange(c.value);
          }}
          type="button"
        >
          {c.label}
          {c.count === undefined ? null : <span className={styles.count}>{c.count}</span>}
        </button>
      ))}
    </div>
  );
}
