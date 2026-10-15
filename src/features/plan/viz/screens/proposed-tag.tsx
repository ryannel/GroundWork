import type { ProposedMarks } from '@/application/plan/proposed';

import styles from './proposed-tag.module.css';

interface ProposedTagProps {
  /** What a proposed revision puts in the story; nothing when none is showing. */
  readonly marks?: ProposedMarks | null | undefined;
  readonly id: string;
}

// "new in 1.2": a thing the proposed revision adds or changes, so nobody reads the proposal as what teams build.
export function ProposedTag({ marks, id }: ProposedTagProps) {
  const word = marks?.marks.get(id);
  if (word === undefined) return null;
  return (
    <span className={styles.tag} title="Proposed, not yet approved">
      {word}
    </span>
  );
}
