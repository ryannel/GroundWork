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
}

/** One choice from a short list, such as a domain to cut by or the order to sort in. */
export function Select<T extends string>({ label, value, options, onChange }: SelectProps<T>) {
  return (
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
}
