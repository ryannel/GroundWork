import styles from './select.module.css';

export interface SelectOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

interface SelectProps<T extends string> {
  readonly label: string;
  readonly value: T;
  readonly options: readonly SelectOption<T>[];
  readonly onChange: (value: T) => void;
  /** Shows the label above the box, as a form field does; otherwise it is for screen readers only. */
  readonly shown?: boolean;
}

/** One choice from a short list, such as a domain to cut by or the order to sort in. */
export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  shown = false,
}: SelectProps<T>) {
  const box = (
    <select
      aria-label={label}
      className={styles.select}
      onChange={(event) => {
        const picked = options.find((o) => o.value === event.target.value);
        if (picked !== undefined) onChange(picked.value);
      }}
      value={value}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
  if (!shown) return box;
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      {box}
    </label>
  );
}
