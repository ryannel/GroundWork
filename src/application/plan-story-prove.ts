import type { Model } from '@/application/plan/derive';
import { changedLinksWithoutTest, contractPairs, linkWord } from '@/application/plan-viz-contracts';
import { andList } from '@/application/plan-viz-ladder-order';
import { teamName } from '@/application/plan-viz-teams';
import { numWord } from '@/application/plan-viz-text';

import {
  capital,
  e2eReach,
  flowName,
  namesOf,
  quoted,
  type E2eReach,
} from './plan-story-prove-flows';

// What chapter 6 claims, worked out from the plan: how far the end-to-end tests reach, whether every new link has a contract
// test, and which change is least proven.

/** Headline room: about two lines of the display type. */
const HEAD_MAX = 84;
const WEAK_SHOWN = 3;

export interface Fitted {
  readonly headline: string;
  /** The parts that did not fit, as sentences for the lede. */
  readonly rest: string;
}

/** Parts joined by "; " until the next one would pass two lines; the rest, as sentences, for the lede. */
export function fitParts(parts: readonly string[]): Fitted {
  let head = parts[0] ?? '';
  let used = 1;
  while (used < parts.length) {
    const next = `${head}; ${parts[used] ?? ''}`;
    if (next.length > HEAD_MAX) break;
    head = next;
    used += 1;
  }
  const rest = parts
    .slice(used)
    .map((p) => `${capital(p)}.`)
    .join(' ');
  return { headline: `${head}.`, rest };
}

/** "Not covered end to end" flows beside the headline: the list the first screen of the chapter names. */
export interface E2eHead extends Fitted {
  readonly reach: E2eReach;
}

const some = (reach: E2eReach, list: E2eReach['changed']): string =>
  list.length <= 2
    ? andList(list.map(quoted))
    : `${numWord(list.length)} of the ${numWord(reach.changed.length)} changed flows`;

/** 6.1's claim: what the end-to-end tests cover of the changed flows, and what they do not. */
export function e2eHeadline(model: Model): E2eHead {
  const reach = e2eReach(model);
  const parts: string[] = [];
  if (reach.none.length > 0) parts.push(`no end-to-end test covers ${some(reach, reach.none)}`);
  if (reach.partial.length > 0) {
    const verb = reach.partial.length === 1 ? 'is' : 'are';
    parts.push(`${some(reach, reach.partial)} ${verb} covered only in part`);
  }
  if (parts.length > 0) {
    const fitted = fitParts(parts);
    return { headline: capital(fitted.headline), rest: fitted.rest, reach };
  }
  const shown =
    reach.changed.length > 0
      ? reach.changed
      : model.toBe.flows.filter((f) => reach.walkedIds.includes(f.id));
  const names = namesOf(shown.map(flowName));
  return {
    headline:
      reach.changed.length > 0
        ? `Every changed flow is covered end to end: ${names}.`
        : `End-to-end tests cover ${names}.`,
    rest: '',
    reach,
  };
}

/** The line under 6.1's headline: how many tests, over how many flows, then what the headline had no room for. */
export function e2eLede(tests: number, flows: number, rest: string): string {
  const verb = tests === 1 ? 'test covers' : 'tests cover';
  const what = `${capital(numWord(tests))} end-to-end ${verb} ${numWord(flows)} ${flows === 1 ? 'flow' : 'flows'}.`;
  return rest === '' ? what : `${what} ${rest}`;
}

export interface ContractEvidence {
  readonly tests: number;
  readonly links: number;
  readonly providers: number;
}

/** How many contract tests check how many links, between whom: the evidence under 6.2's headline. */
export function contractEvidence(model: Model): ContractEvidence {
  const pairs = contractPairs(model).flatMap((p) =>
    p.consumer === null || p.provider === null
      ? []
      : [{ test: p.test, consumer: p.consumer, provider: p.provider }],
  );
  return {
    tests: new Set(pairs.map((p) => p.test)).size,
    links: new Set(pairs.map((p) => `${p.consumer}|${p.provider}`)).size,
    providers: new Set(pairs.map((p) => p.provider)).size,
  };
}

export function evidenceLine(e: ContractEvidence): string {
  if (e.providers === 0) return '';
  const tests = e.tests === 1 ? 'test covers' : 'tests cover';
  const links = e.links === 1 ? 'link' : 'links';
  return `${capital(numWord(e.tests))} contract ${tests} ${numWord(e.links)} ${links} between services.`;
}

/** 6.2's claim: whether every new or re-routed call has a contract test, and the one that has not. */
export function contractHeadline(model: Model, ev: ContractEvidence): string {
  const missing = changedLinksWithoutTest(model);
  if (ev.providers === 0) {
    return missing.length > 0
      ? 'No contract test checks a call between services: nothing stops a provider breaking what a consumer reads.'
      : 'No contract tests yet: nothing stops a provider breaking what a consumer reads.';
  }
  const [only] = missing;
  if (only === undefined) return 'Every new or re-routed call has a contract test.';
  if (missing.length === 1) {
    const how = model.status(only.via) === 'added' ? 'new' : 're-routed';
    return `The ${how} ${linkWord(only.via)} “${model.label(only.via)}” has no contract test.`;
  }
  return `Contract tests miss ${numWord(missing.length)} new or re-routed links between services.`;
}

export interface Weakest {
  /** What is missing: "No test at all". */
  readonly kind: string;
  readonly ids: readonly string[];
  readonly more: number;
}

export interface CoverageHead extends Fitted {
  readonly weakest: Weakest | null;
}

interface Cut {
  readonly untested: readonly string[];
  readonly unitOnly: readonly string[];
  readonly noE2e: readonly string[];
  readonly unrun: number;
  readonly total: number;
}

function cutOf(model: Model, lens: string | undefined): Cut {
  const cov = model.coverage();
  const cut = lens === undefined ? null : model.teamCut(lens);
  const inCut = (change: string): boolean => cut === null || cut.changes.includes(change);
  return {
    untested: cov.gaps.untested.filter(inCut),
    unitOnly: cov.gaps.unitOnly.filter(inCut),
    noE2e: cov.gaps.noE2e.filter(inCut),
    unrun: cov.gaps.provesWithoutWalking.filter((x) => inCut(x.change)).length,
    total: cov.rows.filter((r) => inCut(r.change)).length,
  };
}

const many = (n: number): string => (n === 1 ? 'one has' : `${numWord(n)} have`);

function untestedPart(model: Model, cut: Cut, lens: string | undefined): string {
  const team = lens === undefined ? null : teamName(model, lens);
  if (cut.untested.length === 1)
    return team === null
      ? 'Every change but one has a test'
      : `${team}’s part: every change but one has a test`;
  const of = `${numWord(cut.untested.length)} of the ${numWord(cut.total)}`;
  const whose = team === null ? 'changes' : `${team} changes`;
  return `No test proves ${of} ${whose}`;
}

/** The part of the headline about tests of the end-to-end kind, once every change has one. */
function reachPart(every: string, reach: E2eReach | null): string {
  if (reach === null || (reach.none.length === 0 && reach.partial.length === 0))
    return `${every}, and each is covered end to end`;
  if (reach.none.length > 0)
    return `${every}, but no end-to-end test covers ${namesOf(reach.none.map(quoted))}`;
  const verb = reach.partial.length === 1 ? 'is' : 'are';
  return `${every}, but ${namesOf(reach.partial.map(quoted))} ${verb} covered only in part`;
}

function leadOf(
  model: Model,
  cut: Cut,
  opts: { lens: string | undefined; reach: E2eReach | null },
): { part: string; weakest: Weakest | null } {
  const { lens, reach } = opts;
  const every =
    lens === undefined
      ? 'Every change has a test'
      : `${teamName(model, lens)}’s part: every change has a test`;
  const weak = (kind: string, ids: readonly string[]): Weakest => {
    const ids3 = ids.slice(0, WEAK_SHOWN);
    return { kind, ids: ids3, more: ids.length - ids3.length };
  };
  if (cut.untested.length > 0)
    return { part: untestedPart(model, cut, lens), weakest: weak('No test at all', cut.untested) };
  if (cut.unitOnly.length > 0)
    return {
      part: `${every}, but ${many(cut.unitOnly.length)} unit tests only`,
      weakest: weak('Unit tests only', cut.unitOnly),
    };
  if (cut.noE2e.length > 0)
    return {
      part: `${every}, but ${many(cut.noE2e.length)} no end-to-end test`,
      weakest: weak('No end-to-end test', cut.noE2e),
    };
  if (cut.total === 0) return { part: 'No changes in this team’s part to prove', weakest: null };
  return { part: reachPart(every, reach), weakest: null };
}

/**
 * 6.3's claim: the change that is least proven (no test at all, then unit tests only, then no end-to-end test), or that every
 * change has a test and where the thin spot is. A team's part counts only that team's changes.
 */
export function coverageHeadline(
  model: Model,
  opts: { lens?: string; reach?: E2eReach } = {},
): CoverageHead {
  const cut = cutOf(model, opts.lens);
  const { part, weakest } = leadOf(model, cut, { lens: opts.lens, reach: opts.reach ?? null });
  const parts = [part];
  if (cut.unrun > 0)
    parts.push(
      cut.unrun === 1
        ? 'one test claims a change but never runs its steps'
        : `${numWord(cut.unrun)} tests claim a change but never run its steps`,
    );
  const fitted = fitParts(parts);
  return { headline: fitted.headline, rest: fitted.rest, weakest };
}
