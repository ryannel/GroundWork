import type { Model } from '@/application/plan/derive';
import { type Deciding, deciding, titleOf } from '@/application/plan-viz-decision';
import { andList } from '@/application/plan-viz-ladder-order';
import { buildSummary } from '@/application/plan-viz-milestone';
import { shortDate } from '@/application/plan-viz-state';
import { teamName } from '@/application/plan-viz-teams';
import { numWord } from '@/application/plan-viz-text';

// Where a plan stands and what the teams are asked to do now: one reading for the cover, Your part and the chapters
// that talk about approval. The stage and the gates (the register's "To decide" group).

export type Stage = 'draft' | 'review' | 'approved' | 'in-delivery' | 'delivered';

const IN_DELIVERY: Stage = 'in-delivery';

/** Delivery, once work items have issues, outranks `meta.status`; 'committed' reads as approved. */
export function planStage(model: Model): Stage {
  const summary = buildSummary(model, model.today);
  if (summary.delivered) return 'delivered';
  if (summary.started) return IN_DELIVERY;
  const own = model.plan.meta.status ?? 'draft';
  return own === 'committed' ? 'approved' : own;
}

export const isApproved = (stage: Stage): boolean =>
  stage === 'approved' || stage === IN_DELIVERY || stage === 'delivered';

export const possessive = (name: string): string => `${name}${name.endsWith('s') ? '’' : '’s'}`;

const capital = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);
const lower = (text: string): string => text.charAt(0).toLowerCase() + text.slice(1);
const startsSentenceCase = (text: string): boolean => /^[A-Z][a-z]/u.test(text);

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
export const gateTitle = (e: Deciding, model?: Model): string => titleOf(e, model);

/** A title continued after a colon: lower case unless it is an acronym, and ending in a full stop. */
export function asClause(title: string): string {
  const text = title.trim();
  const clause = startsSentenceCase(text) ? lower(text) : text;
  return /[!.?]$/u.test(clause) ? clause : `${clause}.`;
}

/** The day the plan was approved, as "25 Sep", or ''. */
export function approvedOn(model: Model): string {
  const entry = (model.plan.meta.revisions ?? []).find((r) => r.status === 'approved');
  return entry?.approved_on === undefined ? '' : shortDate(entry.approved_on, model.today);
}

export interface AskLink {
  readonly chapter: 'commit' | 'build' | 'today';
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

const byDay = (day: string | undefined, today: Date | undefined): string =>
  day === undefined ? '' : `, by ${shortDate(day, today)}`;

function gateLead(model: Model, first: Deciding, late: boolean): string {
  const who = first.decider === undefined ? 'Nobody named' : teamName(model, first.decider);
  if (!late || first.decide_by === undefined) {
    return `${who} decides first${byDay(first.decide_by, model.today)}`;
  }
  return `${possessive(who)} answer was due ${shortDate(first.decide_by, model.today)}`;
}

function gateMore(gates: readonly Deciding[], first: Deciding, today: Date | undefined): string {
  const rest = gates.length - 1;
  if (rest === 0) return '';
  const last = gates
    .flatMap((e) => e.decide_by ?? [])
    .toSorted((a, b) => a.localeCompare(b))
    .at(-1);
  const tail =
    last === undefined || last === first.decide_by
      ? ''
      : `, the last due ${shortDate(last, today)}`;
  const verb = rest === 1 ? 'has' : 'have';
  return ` ${capital(numWord(rest))} more ${verb} to be settled before approval${tail}.`;
}

function gateLine(model: Model, gates: readonly Deciding[], today: string): AskLine | null {
  const [head] = gates;
  if (head === undefined) return null;
  const first = gates.find((e) => e.decide_by !== undefined) ?? head;
  const late = first.decide_by !== undefined && first.decide_by.localeCompare(today) < 0;
  return {
    tone: late ? 'warn' : 'note',
    text: `${gateLead(model, first, late)}: ${asClause(gateTitle(first, model))}${gateMore(gates, first, model.today)}`,
    link: STILL_TO_SETTLE,
  };
}

const NOTHING_LEFT = 'Nothing is left to decide: the owner can approve it by merging.';

function beforeApproval(model: Model, today: string): AskLine[] {
  const gate = gateLine(model, gatesOf(model), today);
  return [gate ?? { tone: 'note', text: NOTHING_LEFT, link: STILL_TO_SETTLE }];
}

function inDelivery(model: Model, today: string): AskLine[] {
  const summary = buildSummary(model, model.today);
  const ms = (model.plan.milestones ?? []).find((m) => m.id === summary.current?.id);
  if (ms === undefined) return [];
  const teams = [...new Set(summary.left.map((w) => w.team))].map((t) => teamName(model, t));
  const late = ms.due !== undefined && ms.due.localeCompare(today) < 0;
  const name = model.label(ms.id).split(' · ')[0] ?? ms.id;
  const dueWord = late ? 'which was due' : 'due';
  const due = ms.due === undefined ? '' : `, ${dueWord} ${shortDate(ms.due, model.today)}`;
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
  const { closed } = buildSummary(model, model.today);
  const last = closed === null ? '' : `; the last closed ${shortDate(closed, model.today)}`;
  const text = `Every work item is done${last}.`;
  return {
    tone: 'note',
    text,
    link: { chapter: 'build', screen: 'build-order', label: 'How it was built →' },
  };
}

/**
 * The lines of the ask, loudest first. None repeats the stage word the top bar already carries. Today is an ISO
 * date (YYYY-MM-DD), against which answers and milestones are late.
 */
export function askLines(model: Model, today: string): AskLine[] {
  const stage = planStage(model);
  if (!isApproved(stage)) return beforeApproval(model, today);
  if (stage === 'delivered') return [deliveredLine(model)];
  return stage === IN_DELIVERY ? inDelivery(model, today) : [approvedLine(model)];
}
