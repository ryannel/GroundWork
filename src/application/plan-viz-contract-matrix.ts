import type { Model } from '@/application/plan/derive';
import {
  changedLinksWithoutTest,
  contractPairs,
  interfacePairs,
  pairKey,
  type Pair,
} from '@/application/plan-viz-contracts';
import { teamOf } from '@/application/plan-viz-teams';

// The contract tests of a plan as a grid of consumer against provider, and the links no contract test covers.

export interface ContractCell {
  readonly provider: string;
  /** Each test with the calls and events it checks between the two. */
  readonly tests: readonly { readonly test: string; readonly vias: readonly string[] }[];
}

export interface ContractRow {
  readonly consumer: string;
  readonly dim: boolean;
  readonly cells: readonly ContractCell[];
}

export interface MissingLink extends Pair {
  readonly dim: boolean;
  /** The two services are checked through some other call. */
  readonly checkedElsewhere: boolean;
  readonly changed: boolean;
}

export interface ContractFindings {
  readonly providers: readonly string[];
  readonly rows: readonly ContractRow[];
  /** Contract tests that check no call between two services. */
  readonly orphans: readonly string[];
  readonly missing: readonly MissingLink[];
  /** Links nobody tests that this plan leaves alone. */
  readonly untouched: number;
}

const unique = <T>(xs: readonly T[]): T[] => [...new Set(xs)];

function cellOf(
  located: readonly {
    readonly test: string;
    readonly consumer: string;
    readonly provider: string;
    readonly via: string;
  }[],
  consumer: string,
  provider: string,
): ContractCell {
  const here = located.filter((x) => x.consumer === consumer && x.provider === provider);
  return {
    provider,
    tests: unique(here.map((h) => h.test)).map((test) => ({
      test,
      vias: unique(here.filter((h) => h.test === test).map((h) => h.via)),
    })),
  };
}

export function contractFindings(model: Model, lens?: string): ContractFindings {
  const pairs = contractPairs(model);
  const located = pairs.flatMap((p) =>
    p.consumer === null || p.provider === null || p.via === null
      ? []
      : [{ test: p.test, consumer: p.consumer, provider: p.provider, via: p.via }],
  );
  const providers = unique(located.map((p) => p.provider));
  const dimmed = (svc: string): boolean => lens !== undefined && teamOf(model, svc) !== lens;
  const rows = unique(located.map((p) => p.consumer)).map((consumer) => ({
    consumer,
    dim: dimmed(consumer),
    cells: providers.map((provider) => cellOf(located, consumer, provider)),
  }));
  const covered = new Set(located.map((p) => pairKey(p)));
  const coveredPair = new Set(located.map((p) => `${p.consumer}|${p.provider}`));
  const missing = changedLinksWithoutTest(model).map((p) => ({
    ...p,
    dim: dimmed(p.consumer) && dimmed(p.provider),
    checkedElsewhere: coveredPair.has(`${p.consumer}|${p.provider}`),
    changed: model.status(p.via) !== 'existing',
  }));
  const listed = new Set(missing.map((p) => pairKey(p)));
  const untouched = interfacePairs(model).filter(
    (p) =>
      !covered.has(pairKey(p)) && !listed.has(pairKey(p)) && model.status(p.via) === 'existing',
  ).length;
  return {
    providers,
    rows,
    orphans: pairs.filter((p) => p.consumer === null).map((p) => p.test),
    missing,
    untouched,
  };
}
