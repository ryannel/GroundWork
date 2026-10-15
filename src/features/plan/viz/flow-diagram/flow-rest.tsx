import styles from './flow-rest.module.css';

const FOLD_FROM = 3;

export interface RestNoteProps {
  /** The teams with no part in the flow, by name. */
  readonly teams: readonly string[];
  /** A long list folds to its count: it is context, not the drawing. */
  readonly fold?: boolean | undefined;
}

/** Who the flow leaves out, so a reader can tell a quiet team from a missing one. Nothing when every team is in it. */
export function RestNote({ teams, fold = false }: RestNoteProps) {
  if (teams.length === 0) return null;
  const names = teams.join(' · ');
  if (fold && teams.length >= FOLD_FROM) {
    return (
      <details className={styles.fold} data-keep="other-teams">
        <summary>{String(teams.length)} teams not in this flow</summary>
        {names}
      </details>
    );
  }
  return <p className={styles.line}>Not in this flow · {names}</p>;
}
