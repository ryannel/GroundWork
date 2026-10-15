import { memoPerGraph, fieldNode, operationNode } from '@/application/plan/federation-index';
import { queryPlan } from '@/application/plan/federation-plan';
import type { Fetch } from '@/application/plan/federation-plan-types';
import { responsePolicy, type ResponsePolicy } from '@/application/plan/federation-policy';
import {
  fieldDataTier,
  operationDataTier,
  responseTiers,
  type Draft,
  type PerFetch,
  type RowState,
  type TierFacts,
} from '@/application/plan/federation-tiers';
import type { SystemGraph } from '@/domain/plan/plan-graph';

export type CacheCase = 'hit' | 'miss' | 'cold';

export type CacheRow = Omit<Draft, 'blocked' | 'observed'> & {
  /** Why a blocked row cannot be used. */
  why: string | null;
  /** Whether the row is filled on the way back (a miss). */
  fills: boolean;
  latency: number | null;
};

export interface CachePath {
  id: string;
  case: CacheCase;
  /** The store that skips every fetch; null when the subgraphs do some work. */
  answeredBy: string | null;
  /** A gateway entity cache that was hit but leaves some fetches to run. */
  partial: string | null;
  layers: CacheRow[];
  fetches: (Fetch & { state: 'run' | 'skipped' })[];
  policy: ResponsePolicy | null;
}

const paths = memoPerGraph<CachePath>();

/** A tier answers only when it skips every fetch; an entity cache with an uncacheable fetch answers part. */
const answers = (row: Draft): boolean =>
  row.granularity === 'response' ||
  (row.granularity === 'entity' && (row.perFetch ?? []).every((p) => p.cacheable));

type FetchState = Map<string, 'run' | 'skipped'>;

function tierState(row: Draft, index: number, answerAt: number): RowState {
  if (row.blocked !== undefined) return 'blocked';
  if (index < answerAt) return 'miss';
  return index === answerAt ? 'hit' : 'skipped';
}

function entityFetchState(row: Draft, p: PerFetch, fetchState: FetchState): RowState {
  if (row.state === 'blocked') return 'blocked';
  const state = p.cacheable ? row.state : 'skipped';
  if (state === 'hit') fetchState.set(p.fetch, 'skipped');
  return row.state === 'skipped' && fetchState.get(p.fetch) === 'skipped' ? 'skipped' : state;
}

function withFetchStates(row: Draft, fetchState: FetchState): Draft {
  const perFetch = (row.perFetch ?? []).map((p) => ({
    ...p,
    state: entityFetchState(row, p, fetchState),
  }));
  return { ...row, perFetch };
}

/** Data caches: hit when their fetch runs (hit and miss cases), miss when cold, skipped when the fetch never runs. */
function dataState(row: Draft, kase: CacheCase, fetchState: FetchState): RowState {
  if (row.fetch !== undefined && fetchState.get(row.fetch) === 'skipped') return 'skipped';
  return kase === 'cold' || (row.fetch === undefined && kase === 'miss') ? 'miss' : 'hit';
}

function toRow(r: Draft): CacheRow {
  const { blocked, observed, ...rest } = r;
  const latency = observed?.latency_ms;
  let measured: number | null = null;
  if (r.state === 'hit') measured = latency?.hit ?? null;
  else if (r.state === 'miss') measured = latency?.miss ?? null;
  return { ...rest, why: blocked ?? null, fills: r.state === 'miss', latency: measured };
}

interface Tiers {
  response: Draft[];
  data: Draft[];
}

/** The response tiers with their state, the row that answers (if any), and which fetches still run. */
function settleResponse(
  tiers: Draft[],
  kase: CacheCase,
  fetches: readonly Fetch[],
): { rows: Draft[]; answer: Draft | undefined; fetchState: FetchState } {
  const live = tiers.filter((r) => r.blocked === undefined);
  const answer = { hit: live[0], miss: live[1], cold: undefined }[kase];
  const answerAt = answer === undefined ? Infinity : tiers.indexOf(answer);
  const fetchState: FetchState = new Map(fetches.map((f) => [f.id, 'run']));
  if (answer?.granularity === 'response') {
    for (const k of fetchState.keys()) fetchState.set(k, 'skipped');
  }
  const rows = tiers.map((r, i) => {
    const settled = { ...r, state: tierState(r, i, answerAt) };
    return settled.granularity === 'entity' ? withFetchStates(settled, fetchState) : settled;
  });
  return { rows, answer, fetchState };
}

function settle(
  fetches: readonly Fetch[],
  tiers: Tiers,
  kase: CacheCase,
): Pick<CachePath, 'answeredBy' | 'partial' | 'layers' | 'fetches'> {
  const { rows, answer, fetchState } = settleResponse(tiers.response, kase, fetches);
  const data = tiers.data.map((r) => ({ ...r, state: dataState(r, kase, fetchState) }));
  const answered = answer !== undefined && answers(answer);
  return {
    answeredBy: answered ? answer.store : null,
    partial: answer !== undefined && !answered ? answer.store : null,
    layers: [...rows, ...data].map((r) => toRow(r)),
    fetches: fetches.map((f) => ({ ...f, state: fetchState.get(f.id) ?? 'run' })),
  };
}

function cachePathOf(g: SystemGraph, id: string, kase: CacheCase): CachePath {
  const op = operationNode(g, id);
  if (op !== undefined) {
    const facts: TierFacts = { g, op, plan: queryPlan(g, id), policy: responsePolicy(g, id) };
    const tiers = { response: responseTiers(facts), data: operationDataTier(facts) };
    return { id, case: kase, ...settle(facts.plan.fetches, tiers, kase), policy: facts.policy };
  }
  const fd = fieldNode(g, id);
  const data = fd === undefined ? [] : fieldDataTier(g, fd);
  return { id, case: kase, ...settle([], { response: [], data }, kase), policy: null };
}

/**
 * The cache layers in front of an operation (or behind a graph field) and what happens in one case: hit = the
 * outermost live layer answers; miss = it misses and the next answers; cold = every layer misses and fills on the
 * way back. A row an operation cannot use stays in the list as `blocked`, with `why` saying so.
 */
export function cachePath(g: SystemGraph, id: string, kase = 'cold'): CachePath {
  const k: CacheCase = kase === 'hit' || kase === 'miss' ? kase : 'cold';
  return paths(g, `${id}|${k}`, () => cachePathOf(g, id, k));
}
