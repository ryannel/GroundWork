import type { Model } from '@/application/plan/derive';
import { chipInfo, questionTitle } from '@/application/plan-chips';
import { isoDay, shortDate } from '@/application/plan-viz-state';
import { plainLine } from '@/application/plan-viz-text';
import type { Decision, Question } from '@/domain/plan/plan.generated';

// A decision or a question as one card: what it is, when it stands, what hangs on it.

export type Deciding = Decision | Question;

export const isDecision = (e: Deciding): e is Decision => e.id.startsWith('dec:');

const DOOR: Readonly<Record<string, string>> = {
  'one-way': 'hard to reverse',
  'two-way': 'easy to reverse',
};
const DONE = new Set(['accepted', 'resolved', 'answered']);
const NOT_OPEN = new Set(['deferred', 'rejected', 'superseded']);
/** The states the page's group headings already name (To decide, Decided): a card in one of them need not say it again. */
const GROUPED = new Set(['accepted', 'proposed', 'open', 'resolved', 'answered']);
const FIRST_SENTENCE = /^.+?[!.?](?=\s|$)/u;

const doorWord = (e: Deciding): string =>
  isDecision(e) ? (DOOR[e.reversibility ?? ''] ?? '') : '';
export const titleOf = (e: Deciding): string =>
  isDecision(e) ? plainLine(e.title) : questionTitle(e.question);
export const stateOf = (e: Deciding): string => e.status;
export const sayStateOnCard = (e: Deciding): boolean => !GROUPED.has(stateOf(e));

/** The decision or question behind an id. */
export function deciding(model: Model, id: string): Deciding | undefined {
  return [...(model.plan.decisions ?? []), ...(model.plan.questions ?? [])].find(
    (e) => e.id === id,
  );
}

/** The first sentence of a markdown text, still markdown so [[refs]] stay chips. */
export function firstSentenceMd(text?: string): string {
  const t = (text ?? '').trim().replaceAll(/\s+/gu, ' ');
  return FIRST_SENTENCE.exec(t)?.[0] ?? t;
}

export interface When {
  /** "by", "on", "revisit by", "was due". */
  readonly label: string;
  readonly date: string;
  /** Open and dated: worth checking against today. */
  readonly pending: boolean;
}

/** When a decision or question stands: "decide by 23 Oct", "decided on 18 Sep", "revisit by 26 Feb 2027", or null. */
export function whenOf(e: Deciding): When | null {
  const state = stateOf(e);
  if (DONE.has(state)) {
    const on = isDecision(e) ? e.decided_on : undefined;
    return on === undefined ? null : { label: 'on', date: on, pending: false };
  }
  if (e.decide_by === undefined) return null;
  const closed = NOT_OPEN.has(state);
  let label = closed ? 'was due' : 'by';
  if (state === 'deferred') label = 'revisit by';
  return { label, date: e.decide_by, pending: !closed };
}

/** "decided" once settled, "owns it" once put aside, "decides" while it waits. */
function deciderVerb(e: Deciding): string {
  const state = stateOf(e);
  if (DONE.has(state)) return 'decided';
  return NOT_OPEN.has(state) ? 'owns it' : 'decides';
}

export interface OptionLine {
  readonly name: string;
  readonly chosen: boolean;
  readonly why: string;
}

/** The decision itself first, marked chosen, then each alternative with why not. */
export function optionsOf(e: Deciding): OptionLine[] {
  const others = isDecision(e) ? (e.options ?? []) : [];
  if (others.length === 0 || !isDecision(e)) return [];
  return [
    { name: plainLine(e.title), chosen: true, why: '' },
    ...others.map((o) => ({ name: plainLine(o.name), chosen: false, why: o.why_not ?? '' })),
  ];
}

export interface Ties {
  /** Risks accepted with it. */
  readonly risks: readonly string[];
  /** Questions it answers. */
  readonly answers: readonly string[];
  readonly waiting: readonly string[];
  readonly notes: readonly string[];
}

export function tiesOf(model: Model, e: Deciding): Ties {
  const risks = isDecision(e)
    ? (model.plan.risks ?? []).filter((r) => r.accepted_by === e.id).map((r) => r.id)
    : [];
  const weight = model.weightOf(e.id);
  return {
    risks,
    answers: isDecision(e) ? model.answersOf(e.id).map((q) => q.id) : [],
    waiting: weight.ids.filter((x) => !risks.includes(x)),
    notes: weight.notes,
  };
}

/** "R2", "D3": its position in the plan's own list. */
export const numberOf = (model: Model, id: string): string => chipInfo(model, id).number;

export interface Meta {
  readonly decider: string | null;
  readonly verb: string;
  readonly when: (When & { readonly text: string; readonly late: boolean }) | null;
  readonly door: string;
}

/** The line under a card: who decides, by when, and how hard it is to undo. */
export function metaOf(e: Deciding, today: Date | undefined): Meta {
  const when = whenOf(e);
  return {
    decider: e.decider ?? null,
    verb: deciderVerb(e),
    when:
      when === null
        ? null
        : {
            ...when,
            text: shortDate(when.date, today),
            late:
              when.pending &&
              today !== undefined &&
              isoDay(when.date).localeCompare(isoDay(today.toISOString())) < 0,
          },
    door: doorWord(e),
  };
}
