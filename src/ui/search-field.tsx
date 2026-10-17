import styles from './search-field.module.css';

interface SearchFieldProps {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
}

/** A box to type words into, to narrow a list. */
export function SearchField({ label, value, onChange, placeholder }: SearchFieldProps) {
  return (
    <input
      aria-label={label}
      className={styles.field}
      onChange={(event) => {
        onChange(event.target.value);
      }}
      placeholder={placeholder}
      type="search"
      value={value}
    />
  );
}
