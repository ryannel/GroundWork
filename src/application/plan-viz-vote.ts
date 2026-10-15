import type { Model } from '@/application/plan/derive';
import type { Commitment } from '@/domain/plan/plan.generated';

// The confidence vote, one reading for every surface. Teams with work vote, and so does any team that cast one (Legal can
// vote 2 with no work item). A vote under 3 means the plan is rethought before its owner approves it.

export const VOTE_MAX = 5;
const LOW = 3;

export interface VoteSummary {
  /** Teams with work items, plus any team that cast a vote, in plan order. */
  readonly teams: readonly string[];
  readonly votes: ReadonlyMap<string, Commitment>;
  /** Those that voted. */
  readonly cast: readonly string[];
  /** Cast under 3. */
  readonly low: readonly string[];
  readonly missing: readonly string[];
}

export function voteSummary(model: Model): VoteSummary {
  const owners = new Set(model.plan.work_items?.map((w) => w.team));
  const votes = new Map((model.plan.commitment ?? []).map((c) => [c.team, c]));
  const teams = model.plan.teams
    .map((t) => t.id)
    .filter((t) => owners.has(t) || votes.get(t)?.confidence !== undefined);
  const cast = teams.filter((t) => votes.get(t)?.confidence !== undefined);
  return {
    teams,
    votes,
    cast,
    low: cast.filter((t) => (votes.get(t)?.confidence ?? VOTE_MAX) < LOW),
    missing: teams.filter((t) => votes.get(t)?.confidence === undefined),
  };
}

/** "4 of 5", "not yet", or '' for a team with neither work nor a vote. */
export function voteText(model: Model, team: string): string {
  const s = voteSummary(model);
  if (!s.teams.includes(team)) return '';
  const n = s.votes.get(team)?.confidence;
  return n === undefined ? 'not yet' : `${String(n)} of ${String(VOTE_MAX)}`;
}

export interface VoteTile {
  readonly team: string;
  readonly score: number | null;
  readonly low: boolean;
  readonly note: string | null;
}

/** One tile per team that rates; a vote under 3 leads. */
export function voteTileList(model: Model, teams: readonly string[]): VoteTile[] {
  const { votes } = voteSummary(model);
  const tiles = teams.map((team) => {
    const v = votes.get(team);
    const score = v?.confidence ?? null;
    return { team, score, low: score !== null && score < LOW, note: v?.note ?? null };
  });
  return [...tiles.filter((t) => t.low), ...tiles.filter((t) => !t.low)];
}
