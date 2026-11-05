import styles from './text-field.module.css';

interface TextFieldProps {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  /** text by default; date gives the browser's date picker, url its keyboard. */
  readonly type?: 'text' | 'date' | 'url';
  /** Several lines, for a note. */
  readonly multiline?: boolean;
  readonly placeholder?: string;
}

/** A labelled box to type one value into, in a form. */
export function TextField({
  label,
  value,
  onChange,
  type = 'text',
  multiline = false,
  placeholder,
}: TextFieldProps) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      {multiline ? (
        <textarea
          className={styles.input}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          placeholder={placeholder}
          rows={3}
          value={value}
        />
      ) : (
        <input
          className={styles.input}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          placeholder={placeholder}
          type={type}
          value={value}
        />
      )}
    </label>
  );
}
