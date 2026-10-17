import type { Model } from '@/application/plan/derive';
import {
  approvedOn,
  gatesOf,
  isApproved,
  lowVoteSentence,
  planStage,
  type Stage,
} from '@/application/plan-story-cover-standing';
import { type Deciding, isDecision, metaOf, numberOf } from '@/application/plan-viz-decision';
import { andList } from '@/application/plan-viz-ladder-order';
import { buildSummary } from '@/application/plan-viz-milestone';
import { shortDate } from '@/application/plan-viz-state';
import { teamIndex, teamName } from '@/application/plan-viz-teams';
import { countWord, numWord } from '@/application/plan-viz-text';
import { voteSummary, type VoteSummary } from '@/application/plan-viz-vote';

// 8.4 Still to settle: what is owed, then the vote, in one shape per state of the plan.

const capital = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);
const FAR = '\uFFFF';
const NO_TEAM = 1_000_000;

export interface AskGroup {
  /** The deciding team, or null when nobody is named. */
  readonly decider: string | null;
  readonly items: readonly Deciding[];
}

/** The gates grouped by the team that decides: the team with the soonest date first, then plan order, nobody last. */
function askGroups(model: Model, open: readonly Deciding[]): AskGroup[] {
  const soonest = (d: string | null): string =>
    open
      .filter((e) => (e.decider ?? null) === d)
      .flatMap((e) => e.decide_by ?? [])
      .toSorted((a, b) => a.localeCompare(b))[0] ?? FAR;
  const rank = (d: string | null): number => (d === null ? NO_TEAM : teamIndex(model, d));
  const order = (a: string | null, b: string | null): number => {
    const byDate = soonest(a).localeCompare(soonest(b));
    return byDate === 0 ? rank(a) - rank(b) : byDate;
  };
  const deciders = [...new Set(open.map((e) => e.decider ?? null))].toSorted(order);
  return deciders.map((decider) => ({
    decider,
    items: open.filter((e) => (e.decider ?? null) === decider),
  }));
}

function asksOf(open: readonly Deciding[]): string {
  const decisions = open.filter(isDecision).length;
  const questions = open.length - decisions;
  return andList([
    ...(questions === 0 ? [] : [countWord(questions, 'answer')]),
    ...(decisions === 0 ? [] : [countWord(decisions, 'decision')]),
  ]);
}

const dueClause = (first: Deciding | undefined, lead: string, today: Date | undefined): string =>
  first?.decide_by === undefined ? '' : `${lead}${shortDate(first.decide_by, today)}`;

/** What the plan waits on, counted: "Billing owes two answers and one decision the plan waits on; the first is due 16 Oct." */
function owesLine(model: Model, open: readonly Deciding[]): string {
  if (open.length === 0) return '';
  const asks = asksOf(open);
  const first = open.find((e) => e.decide_by !== undefined);
  const names = [...new Set(open.flatMap((e) => e.decider ?? []))].map((d) => teamName(model, d));
  if (names.length > 0 && names.length <= 3) {
    const verb = names.length === 1 ? 'owes' : 'owe';
    const due = dueClause(first, '; the first is due ', model.today);
    return `${andList(names)} ${verb} ${asks} the plan waits on${due}.`;
  }
  const who = first?.decider === undefined ? 'One team' : teamName(model, first.decider);
  const teams = numWord(Math.max(names.length, 1));
  return `${who} answers first${dueClause(first, ', by ', model.today)}; ${teams} teams owe ${asks} the plan waits on.`;
}

export interface Also {
  readonly e: Deciding;
  readonly why: string;
}

/**
 * Open questions and proposed decisions that are not gates, each with why not: answered by a proposed decision (it is
 * settled with it), or nothing waits on it. So a page that counts the gates still names every open item.
 */
function alsoOpen(model: Model, open: readonly Deciding[]): Also[] {
  const ids = new Set(open.map((e) => e.id));
  const items: Deciding[] = [
    ...(model.plan.questions ?? []).filter((q) => q.status !== 'resolved'),
    ...(model.plan.decisions ?? []).filter((d) => d.status === 'proposed'),
  ];
  return items
    .filter((e) => !ids.has(e.id))
    .map((e) => {
      const by = 'answered_by' in e ? e.answered_by : undefined;
      return {
        e,
        why: by === undefined ? 'nothing waits on it' : `settled with ${numberOf(model, by)}`,
      };
    });
}

/** Open, dated and past its date; never when today is not known. */
export const isLate = (e: Deciding, today: Date | undefined): boolean =>
  metaOf(e, today).when?.late === true;

export interface AskWords {
  readonly headline: string;
  readonly lede: string;
  readonly closing: string;
  /** The sub-heading over the gates when a low rating leads. */
  readonly owes: string;
}

interface Standing {
  readonly stage: Stage;
  readonly open: readonly Deciding[];
  readonly vote: VoteSummary;
  readonly today: Date | undefined;
}

function approvedWords(model: Model, standing: Standing): AskWords {
  const { stage, open } = standing;
  const when = approvedOn(model);
  const version = model.plan.meta.version ?? 'this version';
  const approved = when === '' ? 'Approved.' : `Approved ${when}.`;
  const closed = buildSummary(model, model.today).closed;
  const built = `Teams build from ${version}.`;
  let headline = `${approved} ${built}`;
  if (stage === 'delivered') {
    headline = closed === null ? 'Delivered.' : `Delivered ${shortDate(closed, model.today)}.`;
  } else if (stage === 'in-delivery') headline = approved;
  const are = open.length === 1 ? 'item is' : 'items are';
  const lede = open.length === 0 ? '' : `${capital(numWord(open.length))} ${are} still open.`;
  return { headline, lede, closing: '', owes: '' };
}

function lowWords(model: Model, standing: Standing, name: string): AskWords {
  const { open, vote } = standing;
  const settle = open.length > 0 ? ' and the open items above are settled' : '';
  return {
    headline: lowVoteSentence(model, vote.low, vote.votes),
    lede: 'A rating under 3 means the plan is rethought before its owner approves it.',
    closing: `The plan’s owner approves ${name} by merging its pull request, once the rating under 3 is dealt with${settle}.`,
    owes: owesLine(model, open),
  };
}

function overdueNote(late: number): string {
  if (late === 0) return '';
  return `${capital(numWord(late))} ${late === 1 ? 'is' : 'are'} overdue. `;
}

function closingOwed(standing: Standing): string {
  const { open, vote, today } = standing;
  if (open.length === 0) {
    const allIn = vote.teams.length > 0 && vote.cast.length === vote.teams.length;
    return allIn
      ? 'Nothing is open and every team has rated its confidence.'
      : 'Every team still has to rate its confidence.';
  }
  const last = open
    .flatMap((e) => e.decide_by ?? [])
    .toSorted((a, b) => a.localeCompare(b))
    .at(-1);
  const when = last === undefined ? '' : ` (the last is due ${shortDate(last, today)})`;
  return `They should hear about the open items above first${when}.`;
}

function owedWords(model: Model, standing: Standing, name: string): AskWords {
  const { open } = standing;
  const late = open.filter((e) => isLate(e, model.today)).length;
  const rule =
    'Only what blocks the plan, grouped by the team that decides. If nobody decides, the preferred answer shown applies.';
  return {
    headline:
      open.length > 0
        ? owesLine(model, open)
        : 'Nothing is left to decide. Only the confidence ratings remain.',
    lede: open.length === 0 ? '' : `${overdueNote(late)}${rule}`,
    closing: `The plan’s owner approves ${name} by merging its pull request. ${closingOwed(standing)}`,
    owes: '',
  };
}

export interface Ask extends AskWords {
  readonly stage: Stage;
  readonly approved: boolean;
  readonly open: readonly Deciding[];
  readonly groups: readonly AskGroup[];
  readonly also: readonly Also[];
  readonly vote: VoteSummary;
}

/** What 8.4 says, by state: before approval what is owed and the vote; after it, what stays open and the ratings. */
export function askOf(model: Model): Ask {
  const stage = planStage(model);
  const open = gatesOf(model);
  const vote = voteSummary(model);
  const standing = { stage, open, vote, today: model.today };
  const title = model.plan.meta.title;
  const name = title === '' ? 'the plan' : `“${title}”`;
  const approved = isApproved(stage);
  let words = owedWords(model, standing, name);
  if (approved) words = approvedWords(model, standing);
  else if (vote.low.length > 0) words = lowWords(model, standing, name);
  return {
    ...words,
    stage,
    approved,
    open,
    groups: askGroups(model, open),
    also: alsoOpen(model, open),
    vote,
  };
}
