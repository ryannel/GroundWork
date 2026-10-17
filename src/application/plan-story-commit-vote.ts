import type { Model } from '@/application/plan/derive';
import { andList } from '@/application/plan-viz-ladder-order';
import { teamName } from '@/application/plan-viz-teams';
import { numWord } from '@/application/plan-viz-text';
import type { VoteSummary } from '@/application/plan-viz-vote';

// The confidence ratings on 8.4: what heads them and what the rule is, by the state the plan is in.

const capital = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** Whether any team has an entry in the plan's commitment. */
export const hasCommitment = (model: Model): boolean =>
  (model.plan.commitment ?? []).some((c) => c.team !== '');

/** The heading over the ratings. */
export function voteHead(model: Model, vote: VoteSummary, approved: boolean): string {
  if (!hasCommitment(model)) return 'No team has rated its confidence yet.';
  if (approved) return `Confidence in ${model.plan.meta.version ?? 'this version'}`;
  if (vote.low.length > 0) return 'Confidence ratings';
  const teams = numWord(vote.teams.length);
  if (vote.cast.length === vote.teams.length) {
    return `All ${teams} teams have rated their confidence, and none is below 3.`;
  }
  return `${capital(numWord(vote.cast.length))} of ${teams} teams have rated their confidence, and none is below 3.`;
}

/** What a rating means. The rethink sentence goes once a rating is already under 3. */
export function voteRule(model: Model, vote: VoteSummary): string {
  const { appetite } = model.plan.meta;
  const budget = appetite === undefined ? '' : ` (${appetite})`;
  const rethink = vote.low.length > 0 ? '' : ' Below 3, the plan is rethought.';
  return `Each team building something rates from 1 to 5 how sure it is of delivering its part within the time budget${budget}.${rethink}`;
}

/** The teams that rate, for a plan where nobody has yet. */
export const ratersLine = (model: Model, vote: VoteSummary): string => {
  const names = andList(vote.teams.map((t) => teamName(model, t)));
  return `Teams that rate: ${names === '' ? 'none yet' : names}.`;
};
