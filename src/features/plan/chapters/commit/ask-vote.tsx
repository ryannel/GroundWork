import type { Model } from '@/application/plan/derive';
import {
  hasCommitment,
  ratersLine,
  voteHead,
  voteRule,
} from '@/application/plan-story-commit-vote';
import type { VoteSummary } from '@/application/plan-viz-vote';
import { VoteTiles } from '@/features/plan/viz/vote/vote-tiles';

import styles from './ask-vote.module.css';

interface AskVoteProps {
  readonly model: Model;
  readonly vote: VoteSummary;
  readonly approved: boolean;
  readonly delivered: boolean;
}

/** The confidence ratings, headed for the state the plan is in; a delivered plan folds them away. */
export function AskVote({ model, vote, approved, delivered }: AskVoteProps) {
  const rated = hasCommitment(model);
  const head = voteHead(model, vote, approved);
  const tiles = rated ? <VoteTiles model={model} teams={vote.teams} /> : null;
  if (approved && !rated) return null;
  if (delivered) {
    return (
      <details className={styles.fold}>
        <summary>{head}</summary>
        {tiles}
      </details>
    );
  }
  return (
    <section className={styles.section}>
      <h3 className={styles.heading}>{head}</h3>
      {rated ? null : (
        <p className={styles.rule} role="note">
          {voteRule(model, vote)} {ratersLine(model, vote)}
        </p>
      )}
      {rated && !approved ? <p className={styles.note}>{voteRule(model, vote)}</p> : null}
      {tiles}
    </section>
  );
}

/** Before approval: what the ratings do, and what they do not. */
export function VoteRule() {
  return (
    <p className={styles.note}>
      <b>What do the ratings do?</b> They show how sure each team is. They do not approve anything:
      the plan’s owner does that by merging.
    </p>
  );
}
