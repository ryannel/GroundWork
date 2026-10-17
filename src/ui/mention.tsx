import type { ChipStatus } from './chip';
import { Glyph } from './icon';
import styles from './mention.module.css';

interface MentionProps {
  /** The id the inspector opens when the mention is clicked. */
  readonly id: string;
  readonly label: string;
  readonly glyph?: string;
  readonly status?: ChipStatus;
  readonly mono?: boolean;
}

// The longest label kept on one line; a longer one wraps with the prose around it.
const ONE_LINE = 24;

// A thing named inside running text: its glyph and an underlined name that reads as part of the sentence. A
// button never breaks across lines, so a long name is a span that does, with the glyph glued to its first word.
export function Mention({ id, label, glyph, status = 'existing', mono = false }: MentionProps) {
  const shared = {
    className: styles.mention,
    'data-inspect': id,
    'data-mono': mono ? '' : undefined,
    'data-status': status,
  };
  const icon =
    glyph === undefined ? null : (
      <span aria-hidden="true" className={styles.glyph}>
        <Glyph glyph={glyph} />
      </span>
    );
  if (label.length <= ONE_LINE) {
    return (
      <button {...shared} type="button">
        {icon}
        <span className={styles.name}>{label}</span>
      </button>
    );
  }
  const space = label.indexOf(' ');
  const head = space === -1 ? label : label.slice(0, space);
  return (
    <span {...shared} role="button" tabIndex={0}>
      <span className={styles.head}>
        {icon}
        <span className={styles.name}>{head}</span>
      </span>
      {space === -1 ? null : <span className={styles.name}>{label.slice(space)}</span>}
    </span>
  );
}
