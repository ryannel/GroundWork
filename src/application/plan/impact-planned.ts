import { applyOps } from '@/application/plan/apply-ops';
import { sameJson } from '@/application/plan/derive-values';
import { buildGraph } from '@/application/plan/graph';
import type { SystemGraph, SystemSource } from '@/domain/plan/plan-graph';
import type {
  Endpoint,
  Flow,
  Message,
  Plan,
  Region,
  Schema,
  Screen,
  Service,
  Step,
  Store,
} from '@/domain/plan/plan.generated';

export interface PlacedStep {
  readonly step: Step;
  readonly flow: Flow;
  readonly index: number;
}

/** The planned system of a plan (every change applied), indexed for comparison. */
export interface Planned {
  readonly plan: Plan;
  readonly sys: SystemSource;
  readonly g: SystemGraph;
  readonly steps: ReadonlyMap<string, PlacedStep>;
  readonly regions: ReadonlyMap<string, { readonly region: Region; readonly screen: Screen }>;
  readonly endpoints: ReadonlyMap<string, Endpoint>;
  /** Which changes touch an id: the op's own ids, and the flow or screen they sit in. */
  readonly changesOf: ReadonlyMap<string, ReadonlySet<string>>;
  readonly deprecated: ReadonlySet<string>;
  readonly flows: ReadonlyMap<string, Flow>;
  readonly screens: ReadonlyMap<string, Screen>;
  readonly schemas: ReadonlyMap<string, Schema>;
  readonly messages: ReadonlyMap<string, Message>;
  readonly services: ReadonlyMap<string, Service>;
  readonly stores: ReadonlyMap<string, Store>;
}

/** "billing#id" → "billing". */
export const baseId = (ref: unknown): string =>
  typeof ref === 'string' ? (ref.split('#')[0] ?? '') : '';

const byId = <T extends { readonly id: string }>(list: readonly T[]): Map<string, T> =>
  new Map(list.map((x) => [x.id, x]));

/** "BillingIdentity[]", "list<BillingIdentity>", "BillingIdentity?" → "BillingIdentity". */
export function typeName(t: unknown): string {
  const text = typeof t === 'string' ? t : '';
  const wrapped = /^(?:list|array|set)<(.{1,200})>$/iu.exec(text);
  return (wrapped?.[1] ?? text).replaceAll(/[[\]?!]/gu, '').trim();
}

/** The keys at which two entities differ, bar the ones that say nothing. */
export function changedKeys(a: object, b: object, ignored: readonly string[]): string[] {
  const x = new Map<string, unknown>(Object.entries(a));
  const y = new Map<string, unknown>(Object.entries(b));
  return [...new Set([...x.keys(), ...y.keys()])].filter(
    (k) => !ignored.includes(k) && !sameJson(x.get(k), y.get(k)),
  );
}

const WORD = /\w/u;

/** Does the text name the word whole (not as part of a longer name)? */
export function mentions(text: unknown, word: string | undefined): boolean {
  if (word === undefined || word === '' || typeof text !== 'string') return false;
  for (let at = text.indexOf(word); at !== -1; at = text.indexOf(word, at + 1)) {
    const [before, after] = [text.charAt(at - 1), text.charAt(at + word.length)];
    if (!WORD.test(before) && !WORD.test(after)) return true;
  }
  return false;
}

function placeSteps(sys: SystemSource): Map<string, PlacedStep> {
  const steps = new Map<string, PlacedStep>();
  for (const flow of sys.flows) {
    for (const [index, step] of flow.steps.entries()) steps.set(step.id, { step, flow, index });
  }
  return steps;
}

function changesTouching(
  records: ReturnType<typeof applyOps>['records'],
): Map<string, Set<string>> {
  const changesOf = new Map<string, Set<string>>();
  const put = (id: string | null, change: string | undefined) => {
    if (id === null || id === '' || change === undefined) return;
    const set = changesOf.get(id) ?? new Set<string>();
    changesOf.set(id, set.add(change));
  };
  for (const r of records) {
    for (const id of [r.target, ...r.ids]) {
      put(id, r.changeId);
      put(baseId(id), r.changeId);
    }
  }
  return changesOf;
}

export function planned(plan: Plan): Planned {
  const applied = applyOps(plan, plan.changes ?? []);
  const sys = applied.system;
  const regions = new Map<string, { readonly region: Region; readonly screen: Screen }>();
  for (const screen of sys.screens) {
    for (const region of screen.regions ?? []) regions.set(region.id, { region, screen });
  }
  const endpoints = new Map<string, Endpoint>();
  for (const i of sys.interfaces) for (const e of i.endpoints ?? []) endpoints.set(e.id, e);
  return {
    plan,
    sys,
    g: buildGraph(sys, applied.origins),
    steps: placeSteps(sys),
    regions,
    endpoints,
    changesOf: changesTouching(applied.records),
    deprecated: new Set(
      applied.records.flatMap((r) =>
        r.kind === 'deprecate' && r.target !== null ? [r.target] : [],
      ),
    ),
    flows: byId(sys.flows),
    screens: byId(sys.screens),
    schemas: byId(sys.schemas),
    messages: byId(sys.messages),
    services: byId(sys.services),
    stores: byId(sys.stores),
  };
}
