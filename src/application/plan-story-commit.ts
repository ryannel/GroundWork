import type { Model } from '@/application/plan/derive';
import { type Deciding, deciding, isDecision, titleOf } from '@/application/plan-viz-decision';
import { andList } from '@/application/plan-viz-ladder-order';
import { bySeverity, handlingOf } from '@/application/plan-viz-risks';
import { shortDate } from '@/application/plan-viz-state';
import { teamName } from '@/application/plan-viz-teams';
import { countOf, numWord, plainLine, short } from '@/application/plan-viz-text';
import type { Decision, Question, Risk } from '@/domain/plan/plan.generated';

// Chapter 8 · Decide and commit: the choices the plan rests on, the risks it accepts and the rest of the register.
// Each item is shown in full once; a grouped list says what kind it is, not its state, because the group says that.

const capital = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);
const SENTENCE_CASE = /^(?:[A-Z][a-z]|A\s)/u;
const lowerFirst = (text: string): string =>
  SENTENCE_CASE.test(text) ? text.charAt(0).toLowerCase() + text.slice(1) : text;
const STOP = new Set(['.', ' ', '\n', '\t']);
const TAIL = new Set([',', ':', ';', ' ', '\n', '\t']);
function trimWith(text: string, marks: ReadonlySet<string>): string {
  let end = text.length;
  while (end > 0 && marks.has(text.charAt(end - 1))) end -= 1;
  return text.slice(0, end);
}
const trimStop = (text: string): string => trimWith(text, STOP);

const isQuestion = (e: Deciding): e is Question => !isDecision(e);

export interface RegisterGroup {
  readonly key: string;
  readonly label: string;
  readonly note: string;
  readonly items: readonly Deciding[];
}

/** The register by group, with answered questions dropped from the top level: they fold into their decision. */
export function registerGroups(model: Model): RegisterGroup[] {
  return model.decisionRegister().map((g) => ({
    key: g.key,
    label: g.label,
    note: g.note,
    items: g.items
      .filter((e) => e.answers === undefined)
      .flatMap((e) => deciding(model, e.id) ?? []),
  }));
}

const itemsOf = (groups: readonly RegisterGroup[], key: string): readonly Deciding[] =>
  groups.find((g) => g.key === key)?.items ?? [];

const REST_KEYS = ['deferred', 'loose', 'notes', 'aside'];

/** The register beyond the choices and the gates: deferred, loose ends, discovery notes, set aside. */
export const restGroups = (groups: readonly RegisterGroup[]): RegisterGroup[] =>
  REST_KEYS.map(
    (key) => groups.find((g) => g.key === key) ?? { key, label: key, note: '', items: [] },
  );

/** Below this many items the rest is a line on Still to settle, not a screen. */
export const REST_MIN = 3;

/* ───────── the choices ───────── */

/** A title that opens with a verb reads as "decided to …". */
const IMPERATIVE = new Set(
  'add allow ask avoid block build call charge check choose defer deny drop expire freeze give keep let make merge move offer pass pick publish put reserve require retire run send serve show skip split start stop take treat use warn write'.split(
    ' ',
  ),
);

/** The start of a statement up to a clause break, so a headline stays within two lines. */
function clause(text: string, max = 64): string {
  const t = trimStop(plainLine(text));
  if (t.length <= max) return t;
  for (const sep of [', so ', ' and ', ', ', ' so ', ' because ']) {
    const at = t.indexOf(sep);
    if (at > 16 && at <= max) return t.slice(0, at);
  }
  return trimStop(short(t, max));
}

const norm = (text: string): string =>
  text
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, ' ')
    .trim();
const firstOf = (text: string): string => /^.+?[!.?](?=\s|$)/u.exec(text)?.[0] ?? text;

/**
 * The headline when the plan has one decision and it is accepted: what it settles and who decided it, never the
 * card's own title.
 */
function settledClaim(model: Model, e: Decision): string {
  const who = e.decider === undefined ? 'The plan’s owner' : teamName(model, e.decider);
  const title = trimStop(titleOf(e));
  if (IMPERATIVE.has(title.split(/\s+/u)[0]?.toLowerCase() ?? '')) {
    return `${who} decided to ${lowerFirst(title)}.`;
  }
  const said = trimStop(firstOf(plainLine(e.decision)));
  if (said !== '' && norm(said) !== norm(title)) {
    const text = trimWith(lowerFirst(clause(said, 90)), TAIL);
    return `${who} decided: ${text}${/[.…]$/u.test(text) ? '' : '.'}`;
  }
  const on = e.decided_on === undefined ? '' : ` on ${shortDate(e.decided_on, model.today)}`;
  return `${who} made this choice${on}.`;
}

export interface Choices {
  readonly proposed: readonly Decision[];
  readonly accepted: readonly Decision[];
  /** Resolved questions: counted and headed apart from the decisions made. */
  readonly answered: readonly Question[];
}

/** The choices, the ones the plan rests on most first. */
export function choicesOf(model: Model): Choices {
  const groups = registerGroups(model);
  const heavy = (a: Deciding, b: Deciding): number =>
    model.weightOf(b.id).total - model.weightOf(a.id).total;
  const decided = itemsOf(groups, 'decided');
  return {
    proposed: itemsOf(groups, 'decide').filter(isDecision).toSorted(heavy),
    accepted: decided.filter(isDecision).toSorted(heavy),
    answered: decided.filter(isQuestion).toSorted(heavy),
  };
}

function pronounFor(n: number, of: number): string {
  if (n === 1) return 'it';
  if (n !== of) return numWord(n);
  return n === 2 ? 'both' : 'all';
}

function hardLine(counts: {
  readonly oneWay: number;
  readonly owed: number;
  readonly proposed: number;
}): string {
  const { oneWay, owed, proposed } = counts;
  if (oneWay === 0) return '';
  if (oneWay > proposed || owed < oneWay) {
    return `; ${numWord(oneWay)} of the plan’s choices would be hard to reverse once built`;
  }
  return `; ${pronounFor(oneWay, proposed)} would be hard to reverse once built`;
}

const oneWayOf = (list: readonly Decision[]): Decision[] =>
  list.filter((e) => e.reversibility === 'one-way');

/** Who has to accept what is still proposed, and how much of it is hard to undo: a claim, never a card title. */
export function choicesHeadline(model: Model, c: Choices): string {
  const all = [...c.proposed, ...c.accepted];
  if (all.length === 0) return 'No decisions recorded yet.';
  const [only] = c.accepted;
  if (c.proposed.length === 0) {
    if (all.length === 1 && only !== undefined) return settledClaim(model, only);
    const hardest = oneWayOf(all)[0];
    const undo =
      hardest === undefined
        ? ''
        : `; the hardest to undo: ${lowerFirst(trimStop(titleOf(hardest)))}`;
    return `Every choice is accepted${undo}.`;
  }
  const hard = hardLine({
    oneWay: oneWayOf(all).length,
    owed: oneWayOf(c.proposed).length,
    proposed: c.proposed.length,
  });
  const owed = `${numWord(c.proposed.length)} ${c.proposed.length === 1 ? 'choice' : 'choices'}`;
  const deciders = [...new Set(c.proposed.flatMap((e) => e.decider ?? []))].map((d) =>
    teamName(model, d),
  );
  if (deciders.length === 0) {
    return `${capital(owed)} still ${c.proposed.length === 1 ? 'has' : 'have'} to be accepted${hard}.`;
  }
  return `${andList(deciders)} still ${deciders.length === 1 ? 'has' : 'have'} to accept ${owed}${hard}.`;
}

/** The line under the headline: what is hard to undo, and where the rest is. */
export function choicesLede(c: Choices): string {
  const oneWay = oneWayOf([...c.proposed, ...c.accepted]).length;
  const would = oneWay === 1 ? 'One would be' : `${capital(numWord(oneWay))} would be`;
  const hard = oneWay > 0 && c.proposed.length === 0 ? `${would} hard to reverse once built.` : '';
  const rest =
    c.proposed.length > 0 ? 'Who must decide the rest, and by when, is on the last page.' : '';
  return [hard, rest].filter((x) => x !== '').join(' ');
}

/* ───────── the risks ───────── */

/** "Three risks, biggest first: one owned, one mitigated, one accepted as the price of a decision." Open means owned. */
function riskCounts(rs: readonly Risk[]): string {
  const n = (keep: (r: Risk) => boolean): number => rs.filter(keep).length;
  const settled = new Set(['resolved', 'mitigated', 'accepted']);
  const counts: readonly (readonly [number, string])[] = [
    [n((r) => !settled.has(r.roam ?? 'owned')), 'owned'],
    [n((r) => r.roam === 'mitigated'), 'mitigated'],
    [n((r) => r.roam === 'accepted'), 'accepted as the price of a decision'],
    [n((r) => r.roam === 'resolved'), 'resolved'],
  ];
  const parts = counts
    .filter(([count]) => count !== 0)
    .map(([count, word]) => `${numWord(count)} ${word}`);
  const lead = `${capital(numWord(rs.length))} ${rs.length === 1 ? 'risk' : 'risks'}, biggest first`;
  return parts.length > 0 ? `${lead}: ${andList(parts)}.` : `${lead}.`;
}

/** The plan's risks, the biggest first. */
export const risksBySeverity = (model: Model): Risk[] => bySeverity(model.plan.risks ?? []);

function oneRiskHeadline(model: Model, r: Risk): string {
  const handling = handlingOf(model, r);
  const owner =
    r.owner === undefined ? ', and nobody owns it' : `, and ${teamName(model, r.owner)} owns it`;
  return `The one risk is ${handling === 'owned' ? 'open' : handling}${owner}.`;
}

/** What leads the risks: the biggest, or the only one's handling. */
export function risksHeadline(model: Model, rs: readonly Risk[]): string {
  const [first] = rs;
  if (first === undefined) return 'No risks recorded.';
  if (rs.length === 1) return oneRiskHeadline(model, first);
  const top = rs.find((r) => r.roam !== 'resolved');
  if (top === undefined) return `All ${numWord(rs.length)} risks are resolved.`;
  const said = lowerFirst(clause(top.statement));
  return `Biggest risk: ${said}${said.endsWith('…') ? '' : '.'}`;
}

/** The line under the risks headline; none for a single risk or when there are none. */
export function risksLede(rs: readonly Risk[]): string {
  return rs.length > 1
    ? `${riskCounts(rs)} The grid places each risk by likelihood and impact.`
    : '';
}

/* ───────── the rest ───────── */

const REST_WORD: Readonly<Record<string, readonly [string, string]>> = {
  deferred: ['deferred', 'deferred'],
  loose: ['loose end', 'loose ends'],
  notes: ['discovery note', 'discovery notes'],
  aside: ['set aside', 'set aside'],
};

/** "Two deferred and one loose end. Kept here for the record." */
export function restLede(groups: readonly RegisterGroup[]): string {
  const parts = groups
    .filter((g) => g.items.length > 0)
    .map((g) => {
      const [one, many] = REST_WORD[g.key] ?? [g.key, g.key];
      return `${numWord(g.items.length)} ${g.items.length === 1 ? one : many}`;
    });
  return parts.length === 0 ? '' : `${capital(andList(parts))}. Kept here for the record.`;
}

export const restHeadline = (groups: readonly RegisterGroup[]): string =>
  groups.some((g) => g.items.length > 0)
    ? 'Nothing else here blocks the plan.'
    : 'Nothing else to track.';

export const itemCount = (n: number): string => countOf(n, 'item');
