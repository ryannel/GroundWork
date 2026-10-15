import type { Model } from '@/application/plan/derive';
import { questionTitle } from '@/application/plan-chips';
import { type Deciding, deciding, isDecision } from '@/application/plan-viz-decision';
import { andList } from '@/application/plan-viz-ladder-order';
import { buildSummary } from '@/application/plan-viz-milestone';
import { shortDate } from '@/application/plan-viz-state';
import { teamName } from '@/application/plan-viz-teams';
import { numWord, plainLine } from '@/application/plan-viz-text';
import { voteSummary, type VoteSummary } from '@/application/plan-viz-vote';
import type { Commitment } from '@/domain/plan/plan.generated';

// Where a plan stands and what the room is asked to do now: one reading for the cover, Your part and the chapters
// that talk about approval. The stage, the gates (the register's "To decide" group) and the vote.

export type Stage = 'draft' | 'review' | 'approved' | 'in-delivery' | 'delivered';

/** Delivery, once work items have issues, outranks `meta.status`; 'committed' reads as approved. */
export function planStage(model: Model): Stage {
  const summary = buildSummary(model);
  if (summary.delivered) return 'delivered';
  if (summary.started) return 'in-delivery';
  const own = model.plan.meta.status ?? 'draft';
  return own === 'committed' ? 'approved' : own;
}

export const isApproved = (stage: Stage): boolean =>
  stage === 'approved' || stage === 'in-delivery' || stage === 'delivered';

export const possessive = (name: string): string => `${name}${name.endsWith('s') ? '’' : '’s'}`;

const capital = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);
const lower = (text: string): string => text.charAt(0).toLowerCase() + text.slice(1);
const startsSentenceCase = (text: string): boolean => /^[A-Z][a-z]/.test(text);

const FAR = '\uFFFF';
const byDate = (a: Deciding, b: Deciding): number =>
  (a.decide_by ?? FAR).localeCompare(b.decide_by ?? FAR);

/** What stands between the plan and approval: open questions something waits on and proposed decisions something rests on, soonest first. */
export function gatesOf(model: Model): Deciding[] {
  const group = model.decisionRegister().find((g) => g.key === 'decide');
  return (group?.items ?? [])
    .filter((e) => e.answers === undefined)
    .flatMap((e) => deciding(model, e.id) ?? [])
    .toSorted(byDate);
}

/** The ids a gate holds up (changes, work items, risks…). */
export const heldUp = (model: Model, id: string): readonly string[] => model.weightOf(id).ids;

/** A gate's title in plain words. */
export const gateTitle = (e: Deciding): string =>
  isDecision(e) ? plainLine(e.title) : questionTitle(e.question);

/** A title continued after a colon: lower case unless it is an acronym, and ending in a full stop. */
export function asClause(title: string): string {
  const text = title.trim();
  const clause = startsSentenceCase(text) ? lower(text) : text;
  return /[!.?]$/.test(clause) ? clause : `${clause}.`;
}

const REASON_MAX = 100;
const CLAUSE_MIN = 20;
const REASON_SEPARATORS = [', and ', '; ', ', so ', ', but ', ' because '];

const firstSentence = (text: string): string => {
  const end = /[!.?]\s/.exec(text);
  return end === null ? text : text.slice(0, end.index + 1);
};

const TRAILING = new Set([' ', '.', '…', '\n', '\t']);
function trimEnd(text: string): string {
  let end = text.length;
  while (end > 0 && TRAILING.has(text.charAt(end - 1))) end -= 1;
  return text.slice(0, end);
}

function cutAtClause(text: string, max: number): string {
  const at = REASON_SEPARATORS.map((s) => text.lastIndexOf(s)).find(
    (i) => i > CLAUSE_MIN && i <= max,
  );
  const cut = at === undefined ? text : text.slice(0, at);
  return cut.length > max ? trimEnd(cut.slice(0, max)) : cut;
}

/** A team's note as the reason in a sentence: its first sentence, cut at a clause when long, with no full stop. */
export function reasonOf(note: string | undefined, max = REASON_MAX): string {
  const text = plainLine(note ?? '')
    .trim()
    .replaceAll(/\s+/g, ' ');
  const sentence = firstSentence(text).replace(/[!.?]$/, '');
  const out = sentence.length > max ? cutAtClause(sentence, max) : sentence;
  return startsSentenceCase(out) ? lower(out) : out;
}

const ratingOf = (votes: ReadonlyMap<string, Commitment>, team: string): string =>
  String(votes.get(team)?.confidence ?? '');

/** "Legal is not confident (2 of 5): the price opinion is on file for DE." Several teams: one sentence naming them. */
export function lowVoteSentence(
  model: Model,
  low: readonly string[],
  votes: ReadonlyMap<string, Commitment>,
): string {
  const [first] = low;
  if (first === undefined) return '';
  if (low.length > 1) {
    const names = andList(low.map((t) => teamName(model, t)));
    return `${names} are not confident (${andList(low.map((t) => ratingOf(votes, t)))} of 5).`;
  }
  const why = reasonOf(votes.get(first)?.note);
  const reason = why === '' ? '' : `: ${why}`;
  return `${teamName(model, first)} is not confident (${ratingOf(votes, first)} of 5)${reason}.`;
}

/** The day the plan was approved, as "25 Sep", or ''. */
export function approvedOn(model: Model): string {
  const entry = (model.plan.meta.revisions ?? []).find((r) => r.status === 'approved');
  return entry?.approved_on === undefined ? '' : shortDate(entry.approved_on);
}

export interface AskLink {
  readonly chapter: 'commit' | 'build';
  readonly screen: string;
  readonly label: string;
}

export interface AskLine {
  readonly tone: 'warn' | 'note';
  readonly text: string;
  readonly link: AskLink | null;
}

const STILL_TO_SETTLE: AskLink = { chapter: 'commit', screen: 'ask', label: 'Still to settle →' };
const BUILD_ORDER: AskLink = { chapter: 'build', screen: 'build-order', label: 'Build order →' };

const today = (): string => new Date().toISOString().slice(0, 10);
const byDay = (day: string | undefined): string =>
  day === undefined ? '' : `, by ${shortDate(day)}`;

function gateLead(model: Model, first: Deciding, late: boolean): string {
  const who = first.decider === undefined ? 'Nobody named' : teamName(model, first.decider);
  if (!late || first.decide_by === undefined)
    return `${who} decides first${byDay(first.decide_by)}`;
  return `${possessive(who)} answer was due ${shortDate(first.decide_by)}`;
}

function gateMore(gates: readonly Deciding[], first: Deciding): string {
  const rest = gates.length - 1;
  if (rest === 0) return '';
  const last = gates
    .flatMap((e) => e.decide_by ?? [])
    .toSorted((a, b) => a.localeCompare(b))
    .at(-1);
  const tail =
    last === undefined || last === first.decide_by ? '' : `, the last due ${shortDate(last)}`;
  const verb = rest === 1 ? 'has' : 'have';
  return ` ${capital(numWord(rest))} more ${verb} to be settled before approval${tail}.`;
}

function gateLine(model: Model, gates: readonly Deciding[], hasLow: boolean): AskLine | null {
  const [head] = gates;
  if (head === undefined) return null;
  const first = gates.find((e) => e.decide_by !== undefined) ?? head;
  const late = first.decide_by !== undefined && first.decide_by < today();
  return {
    tone: late ? 'warn' : 'note',
    text: `${gateLead(model, first, late)}: ${asClause(gateTitle(first))}${gateMore(gates, first)}`,
    link: hasLow ? null : STILL_TO_SETTLE,
  };
}

function nothingLeft(model: Model, missing: readonly string[]): string {
  if (missing.length === 0) {
    return 'Nothing is left to decide and every team has rated its confidence: the owner can approve it by merging.';
  }
  const names = andList(missing.map((t) => teamName(model, t)));
  const one = missing.length === 1;
  return `Nothing is left to decide; ${names} ${one ? 'has' : 'have'} not rated ${one ? 'its' : 'their'} confidence yet.`;
}

function beforeApproval(model: Model, vote: VoteSummary): AskLine[] {
  const out: AskLine[] = [];
  const hasLow = vote.low.length > 0;
  if (hasLow) {
    const text = `${lowVoteSentence(model, vote.low, vote.votes)} The owner rethinks the plan before approving it.`;
    out.push({ tone: 'warn', text, link: STILL_TO_SETTLE });
  }
  const gate = gateLine(model, gatesOf(model), hasLow);
  if (gate !== null) out.push(gate);
  else if (!hasLow) {
    out.push({ tone: 'note', text: nothingLeft(model, vote.missing), link: STILL_TO_SETTLE });
  }
  return out;
}

function inDelivery(model: Model): AskLine[] {
  const summary = buildSummary(model);
  const ms = (model.plan.milestones ?? []).find((m) => m.id === summary.current?.id);
  if (ms === undefined) return [];
  const teams = [...new Set(summary.left.map((w) => w.team))].map((t) => teamName(model, t));
  const late = ms.due !== undefined && ms.due < today();
  const name = model.label(ms.id).split(' · ')[0] ?? ms.id;
  const dueWord = late ? 'which was due' : 'due';
  const due = ms.due === undefined ? '' : `, ${dueWord} ${shortDate(ms.due)}`;
  const verb = teams.length === 1 ? 'has' : 'have';
  return [
    {
      tone: late ? 'warn' : 'note',
      text: `${andList(teams)} ${verb} the work left for ${name}${due}.`,
      link: BUILD_ORDER,
    },
  ];
}

function approvedLine(model: Model): AskLine {
  const when = approvedOn(model);
  const version = model.plan.meta.version ?? 'this version';
  const approved = when === '' ? '' : `, approved ${when}`;
  const text = `Teams build from ${version}${approved}.`;
  return { tone: 'note', text, link: BUILD_ORDER };
}

function deliveredLine(model: Model): AskLine {
  const { closed } = buildSummary(model);
  const last = closed === null ? '' : `; the last closed ${shortDate(closed)}`;
  const text = `Every work item is done${last}.`;
  return {
    tone: 'note',
    text,
    link: { chapter: 'build', screen: 'build-order', label: 'How it was built →' },
  };
}

/** The lines of the ask, loudest first. None repeats the stage word the top bar already carries. */
export function askLines(model: Model): AskLine[] {
  const stage = planStage(model);
  if (!isApproved(stage)) return beforeApproval(model, voteSummary(model));
  if (stage === 'delivered') return [deliveredLine(model)];
  return stage === 'in-delivery' ? inDelivery(model) : [approvedLine(model)];
}
