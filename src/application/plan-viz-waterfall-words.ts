import type { Model } from '@/application/plan/derive';
import type { CachePath, CacheRow } from '@/application/plan/federation-cache';
import { chipInfo } from '@/application/plan-chips';
import type { Before } from '@/application/plan-viz-waterfall-compare';
import {
  opPath,
  type WaterfallCase,
  type WaterfallFacts,
} from '@/application/plan-viz-waterfall-facts';
import { andList, secs } from '@/application/plan-viz-waterfall-text';

// The sentences around a waterfall: the case control's choices, one summary line, one caption per case.

const labelOf = (model: Model, id: string): string => chipInfo(model, id).label;

/** A subgraph or store in a sentence: no "subgraph" suffix, no code marks. */
export const nameOf = (model: Model, id: string): string =>
  labelOf(model, id)
    .replace(/\bsubgraph$/iu, '')
    .replaceAll('`', '')
    .trim();

const uniq = (xs: readonly string[]): string[] => [...new Set(xs.filter((x) => x !== ''))];

export interface CaseChoice {
  readonly kase: WaterfallCase;
  readonly label: string;
}

const outer = (cp: CachePath | null, state: CacheRow['state']): CacheRow | undefined =>
  cp?.layers.find((l) => l.layer !== 'subgraph' && l.state === state);

/** The cases this path has: a layer that can answer, and, when two can, the miss that falls to the next. */
export function waterfallCases(model: Model, id: string, mode?: string): CaseChoice[] {
  const hit = outer(opPath(model, { id, mode }, 'hit'), 'hit');
  const miss = opPath(model, { id, mode }, 'miss');
  const cases: CaseChoice[] = [];
  if (hit !== undefined) cases.push({ kase: 'hit', label: `${hit.layer} hit` });
  const edge = outer(miss, 'miss');
  if (hit !== undefined && outer(miss, 'hit') !== undefined && edge !== undefined) {
    cases.push({ kase: 'miss', label: `${edge.layer} miss` });
  }
  cases.push({ kase: 'cold', label: 'cold' });
  return cases;
}

/** The case a waterfall opens on: the one asked for if the path has it, else cold. */
export function landingCase(
  choices: readonly CaseChoice[],
  wanted: string | null | undefined,
): WaterfallCase {
  return choices.find((c) => c.kase === wanted)?.kase ?? 'cold';
}

const counted = (
  now: number,
  was: number | undefined,
  nouns: readonly [string, string],
): string => {
  const noun = now === 1 ? nouns[0] : nouns[1];
  return was !== undefined && was !== now
    ? `${String(was)} → ${String(now)} ${noun}`
    : `${String(now)} ${noun}`;
};

function answeredText(model: Model, cp: CachePath, answered: string): string {
  const ran = cp.fetches.filter((f) => f.state === 'run').length;
  const row = cp.layers.find((l) => l.store === answered);
  const name = labelOf(model, answered);
  if (row?.layer === 'subgraph') {
    return `${name} answered inside its subgraph; the other fetches still ran`;
  }
  return ran === 0
    ? `${name} answered; nothing below it ran`
    : `${name} answered; ${String(ran)} of ${String(cp.fetches.length)} fetches still ran`;
}

function partialText(model: Model, cp: CachePath, partial: string): string {
  const row = cp.layers.find((l) => l.store === partial);
  const hits = (row?.perFetch ?? []).filter((x) => x.state === 'hit').length;
  const ran = cp.fetches.filter((f) => f.state === 'run').length;
  return `${labelOf(model, partial)} answered ${String(hits)} of ${String(cp.fetches.length)} fetches; ${String(ran)} still ran`;
}

function countsText(model: Model, facts: WaterfallFacts, before: Before | null): string {
  const main = [
    counted(facts.roundTrips, before?.roundTrips, ['round trip', 'round trips']),
    counted(facts.fetches, before?.fetches, ['fetch', 'fetches']),
    counted(facts.teams, before?.teams, ['team', 'teams']),
  ].join(' · ');
  if (!facts.layerObserved || facts.slowest === null) return main;
  const via = facts.slowest.via ? ' (via its endpoint)' : '';
  return `${main} · slowest: ${labelOf(model, facts.slowest.subgraph)}${via}`;
}

export interface SummaryOf {
  readonly facts: WaterfallFacts;
  readonly cp: CachePath;
  /** Today's numbers, in a comparison. */
  readonly before: Before | null;
}

/** The one line under a case: what ran, what answered, and what changed since today. */
export function summaryText(model: Model, { facts, cp, before }: SummaryOf): string {
  let main: string;
  if (cp.case === 'cold') main = countsText(model, facts, before);
  else if (cp.answeredBy !== null) main = answeredText(model, cp, cp.answeredBy);
  else if (cp.partial === null) {
    main = countsText(model, facts, before);
  } else {
    main = partialText(model, cp, cp.partial);
  }
  const now = facts.policy?.maxAge;
  if (before !== null && now !== undefined && before.policy.maxAge !== now) {
    main += ` · response life ${secs(before.policy.maxAge)} → ${secs(now)}`;
  }
  return main;
}

function hitCaption(model: Model, cp: CachePath): string {
  if (cp.answeredBy !== null) {
    return `The ${labelOf(model, cp.answeredBy)} has the answer here, so nothing below it runs.`;
  }
  if (cp.partial === null) {
    return 'Nothing on this path can answer on its own, so every request goes all the way down.';
  }
  const row = cp.layers.find((l) => l.store === cp.partial);
  const got = uniq(
    (row?.perFetch ?? []).filter((x) => x.state === 'hit').map((x) => nameOf(model, x.subgraph)),
  );
  const run = uniq(
    cp.fetches.filter((f) => f.state === 'run').map((f) => nameOf(model, f.subgraph)),
  );
  const verb = run.length === 1 ? 'runs' : 'run';
  return `The ${labelOf(model, cp.partial)} answers the ${andList(got)} pieces; ${andList(run)} still ${verb}, so the response still waits on a round trip.`;
}

function missCaption(model: Model, cp: CachePath): string {
  const edge = cp.layers.find((l) => l.layer === 'edge' && l.state === 'miss');
  if (edge === undefined) {
    return 'No edge cache on this path: the first layer that has an answer gives it.';
  }
  const answerId = cp.answeredBy ?? cp.partial;
  const answering = cp.layers.find((l) => l.store === answerId);
  const ev = edge.invalidatedBy.find((e) => !(answering?.invalidatedBy ?? []).includes(e));
  let emptied = 'its time ran out';
  if (ev !== undefined) emptied = `${labelOf(model, ev)} purged it`;
  else if (edge.invalidatedBy.length > 0) emptied = 'it expired or was purged';
  let answer = 'the subgraphs answer';
  if (answerId !== null) {
    const part = cp.partial === null ? '' : ' part of it';
    answer = `${labelOf(model, answerId)} answers${part}`;
  }
  return `The edge missed (${emptied}); the next layer still had the answer, so ${answer}.`;
}

/** The sentence over a case that says which request it is. */
export function captionText(model: Model, cp: CachePath): string {
  if (cp.case === 'hit') return hitCaption(model, cp);
  if (cp.case === 'miss') return missCaption(model, cp);
  return 'No cache has this answer, so every subgraph is asked and each cache fills as the answer returns.';
}
