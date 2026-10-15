import type { FlowStep } from '@/application/plan/flow-steps';
import type { Stop } from '@/application/plan-viz-flow-stops';

// What the step card says about a stop: who talks to whom, what happens, and how it fails.

export type Route =
  | { readonly kind: 'fan'; readonly from: string; readonly to: readonly string[] }
  | { readonly kind: 'chain'; readonly ids: readonly string[] }
  | { readonly kind: 'self'; readonly id: string }
  | { readonly kind: 'pair'; readonly from: string; readonly to: string };

export interface StepRowData {
  readonly n: number;
  readonly id: string;
  readonly action: string;
  /** The interface it goes through; null for an internal step. */
  readonly via: string | null;
  readonly writes: readonly string[];
  readonly reads: readonly string[];
  readonly purges: readonly string[];
}

export interface Narration {
  /** "Step 3" or "Steps 4–6", the number part. */
  readonly num: string;
  readonly group: boolean;
  readonly text: string;
  readonly route: Route;
  readonly vias: readonly string[];
  /** Markdown, or empty. */
  readonly sentence: string;
  readonly purges: readonly string[];
  readonly rows: readonly StepRowData[];
  /** The steps that call an operation, to show what is behind the call. */
  readonly calls: readonly {
    readonly stepId: string;
    readonly via: string;
    readonly kase: string;
  }[];
  readonly fails: readonly { readonly action: string; readonly text: string }[];
  readonly openScreen: string | null;
  readonly first: FlowStep;
}

const WORDS = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];

const unique = <T>(list: readonly T[]): T[] => [...new Set(list)];
const base = (ref: string): string => ref.split('#')[0] ?? ref;
const actionOf = (s: FlowStep): string => (s.action === '' ? s.id : s.action);
const isVia = (via: string): boolean => via !== '' && via !== 'internal';

function routeOf(stop: Stop, list: readonly FlowStep[], first: FlowStep): Route {
  const group = list.length > 1;
  if (stop.fan !== null || (group && list.every((s) => s.from === first.from))) {
    return { kind: 'fan', from: first.from, to: unique(list.map((s) => s.to)) };
  }
  if (group) return { kind: 'chain', ids: unique(list.flatMap((s) => [s.from, s.to])) };
  if (first.from === first.to) return { kind: 'self', id: first.from };
  return { kind: 'pair', from: first.from, to: first.to };
}

function sentenceOf(stop: Stop, list: readonly FlowStep[]): string {
  const targets = unique(list.map((s) => s.to));
  if (stop.fan !== null && targets.length > 1 && list.every((s) => s.from === stop.fan)) {
    return `${WORDS[targets.length] ?? String(targets.length)} components react, each on its own.`;
  }
  if (list.length > 1) return '';
  const main = list.find((s) => (s.logic ?? '') !== '' && s.from !== s.to) ?? list[0];
  return main?.logic ?? '';
}

const purgesOf = (s: FlowStep): string[] => s.purges ?? [];

function rowOf(s: FlowStep, n: number): StepRowData {
  const writes = unique((s.writes ?? []).map(base));
  return {
    n,
    id: s.id,
    action: actionOf(s),
    via: isVia(s.via) ? s.via : null,
    writes,
    reads: unique((s.reads ?? []).map(base)).filter((r) => !writes.includes(r)),
    purges: purgesOf(s),
  };
}

/** The step card's content for a stop; null when the stop has no steps. */
export function narrate(steps: readonly FlowStep[], stop: Stop): Narration | null {
  const list = stop.indices.flatMap((i) => (steps[i] === undefined ? [] : [steps[i]]));
  const [first] = list;
  if (first === undefined) return null;
  const group = list.length > 1;
  const [a, b] = [stop.indices[0] ?? 0, stop.indices.at(-1) ?? 0];
  const screens = unique(list.flatMap((s) => (s.screen === undefined ? [] : [base(s.screen)])));
  return {
    num: group ? `${String(a + 1)}–${String(b + 1)}` : String(a + 1),
    group,
    text: stop.title,
    route: routeOf(stop, list, first),
    vias: unique(list.map((s) => s.via).filter(isVia)),
    sentence: sentenceOf(stop, list),
    purges: group ? [] : purgesOf(first),
    rows: group
      ? stop.indices.flatMap((i) => (steps[i] === undefined ? [] : [rowOf(steps[i], i + 1)]))
      : [],
    calls: list
      .filter((s) => s.via.startsWith('gql:'))
      .map((s) => ({ stepId: s.id, via: s.via, kase: s.case ?? 'cold' })),
    fails: list.flatMap((s) =>
      s.fails === undefined || s.fails === '' ? [] : [{ action: actionOf(s), text: s.fails }],
    ),
    openScreen: screens.length === 1 ? (screens[0] ?? null) : null,
    first,
  };
}

/** The cache case of a step, in words. */
export const caseWords = (kase: string): string => {
  if (kase === 'hit') return 'all cached';
  return kase === 'miss' ? 'not in the edge cache' : 'nothing cached';
};

/** "step 3" or "steps 1–3", in the numbers the drawing carries. */
export const stopLabel = (stop: Stop): string => {
  const a = (stop.indices[0] ?? 0) + 1;
  const b = (stop.indices.at(-1) ?? 0) + 1;
  return a === b ? `step ${String(a)}` : `steps ${String(a)}–${String(b)}`;
};
