import { createContracts, type UncontractedLink } from '@/application/plan/derive-contracts';
import type { Core } from '@/application/plan/derive-core';
import { memo, textOf, tie, uniq } from '@/application/plan/derive-values';
import { parentOf, prop, strings, typeOf } from '@/application/plan/ids';
import type { OpRecord, SystemGraph } from '@/domain/plan/plan-graph';
import { TEST_LEVELS } from '@/domain/plan/plan-vocab';
import type { Test } from '@/domain/plan/plan.generated';

export interface SpanBracket {
  readonly test: string;
  readonly level: Test['level'];
  readonly from: string | undefined;
  readonly to: string | undefined;
  readonly fromIndex: number;
  readonly toIndex: number;
  readonly whole: boolean;
}

export type Gap = 'untested' | 'unit-only' | 'no-e2e';

interface Touch {
  readonly core: Core;
  readonly graphs: readonly SystemGraph[];
  /** Note steps or flows the change touches. */
  readonly hit: (ids: Iterable<string, unknown, undefined>) => void;
  /** Note other entities the change touches (steps that refer to them are touched too). */
  readonly mention: (ids: Iterable<string, unknown, undefined>) => void;
}

const graphsOf = (core: Core): SystemGraph[] => [core.asIs, core.toBe];

const stepsOfFlow = (graphs: readonly SystemGraph[], flow: string): string[] =>
  graphs.flatMap((g) => {
    const f = g.get(flow);
    return f?.$type === 'flow' ? f.steps.map((s) => s.id) : [];
  });

/** Retiring a service touches every step it acts in, or that fans out to it. */
function retire(t: Touch, id: string): void {
  for (const g of t.graphs) {
    const hit = g.steps.filter(
      (s) => s.from === id || s.to === id || t.core.fanout(g, s).services.includes(id),
    );
    t.hit(hit.map((s) => s.id));
  }
}

function touchId(t: Touch, r: OpRecord, id: string): void {
  const type = typeOf(id);
  const retiring = r.kind === 'remove' || r.kind === 'deprecate';
  if (type === 'step' || type === 'flow') {
    t.hit([id]);
    // a whole flow deprecated or removed touches every step in it
    if (type === 'flow') t.hit(stepsOfFlow(t.graphs, id));
  } else if (type === 'service' && retiring) {
    retire(t, id);
  } else if (!retiring) {
    t.mention([id]);
    const p = parentOf(id);
    if (p !== null && p !== '') t.mention([p]);
  }
}

const movedIn = (p: OpRecord['props'][number]): (string | undefined)[] => [
  ...strings(p.before),
  ...strings(p.after),
  textOf(prop(p.before, 'from')),
  textOf(prop(p.after, 'from')),
];

/** A graph field moving between subgraphs touches the steps that reach either side. */
function touchMoved(t: Touch, r: OpRecord): void {
  const moved = r.props
    .filter((p) => p.prop === 'subgraphs' || p.prop === 'override')
    .flatMap((p) => movedIn(p));
  t.mention(moved.filter((x): x is string => x !== undefined && typeOf(x) === 'subgraph'));
}

function touchRecord(t: Touch, r: OpRecord): void {
  for (const id of [r.target, ...r.ids]) if (id !== null) touchId(t, r, id);
  touchMoved(t, r);
  const parent = r.parent ?? '';
  if (r.kind === 'add' && r.type === 'step' && parent !== '') t.hit([parent]);
}

/** Steps (and flows) a change touches. */
function touchedByChange(core: Core, chgId: string): Set<string> {
  const out = new Set<string>();
  const entities = new Set<string>();
  const hit = (ids: Iterable<string, unknown, undefined>): void => {
    for (const id of ids) out.add(id);
  };
  const mention = (ids: Iterable<string, unknown, undefined>): void => {
    for (const id of ids) entities.add(id);
  };
  const t: Touch = { core, graphs: graphsOf(core), hit, mention };
  for (const r of core.records.filter((x) => x.changeId === chgId)) touchRecord(t, r);
  for (const g of t.graphs) {
    for (const s of g.steps) {
      const refs = [
        s.via,
        ...(s.reads ?? []),
        ...(s.writes ?? []),
        ...(s.purges ?? []),
        ...core.fanout(g, s).refs,
      ];
      if (refs.some((x) => entities.has(x) || entities.has(parentOf(x) ?? ''))) out.add(s.id);
    }
  }
  return out;
}

/** The steps one walked id stands for: a flow's steps, an operation's callers, a subgraph's reachers. */
function stepsWalked(core: Core, w: string): string[] {
  const type = typeOf(w);
  if (type === 'flow') return stepsOfFlow(graphsOf(core), w);
  const steps = graphsOf(core).flatMap((g) => g.steps.map((s) => [g, s] as const));
  if (type === 'operation') return steps.filter(([, s]) => s.via === w).map(([, s]) => s.id);
  if (type !== 'subgraph') return [];
  return steps.filter(([g, s]) => core.fanout(g, s).subgraphs.includes(w)).map(([, s]) => s.id);
}

/** Step ids a test walks: listed steps plus every step of a listed flow, an operation's callers and a subgraph's reachers. */
function walkedBy(core: Core, t: Test): Set<string> {
  const out = new Set<string>();
  for (const w of t.walks ?? []) {
    for (const id of [w, ...stepsWalked(core, w)]) out.add(id);
  }
  return out;
}

const unwalked = (t: Test, walked: ReadonlySet<string>, touchedBy: (id: string) => Set<string>) =>
  t.proves
    .filter((c) => ![...walked].some((w) => touchedBy(c).has(w)))
    .map((change) => ({ test: t.id, change }));

function provesWithoutWalking(core: Core, touchedBy: (id: string) => Set<string>) {
  const changeIds = new Set(core.changes.map((c) => c.id));
  return core.tests
    .filter((t) => (t.walks ?? []).length > 0)
    .flatMap((t) =>
      unwalked(
        { ...t, proves: t.proves.filter((x) => changeIds.has(x)) },
        walkedBy(core, t),
        touchedBy,
      ),
    );
}

function gapsOf(ts: readonly Test[], byLevel: Record<string, readonly string[]>): Gap[] {
  const gaps: Gap[] = [];
  if (ts.length === 0) gaps.push('untested');
  else if (ts.every((t) => t.level === 'unit')) gaps.push('unit-only');
  if (ts.length > 0 && (byLevel.e2e ?? []).length === 0) gaps.push('no-e2e');
  return gaps;
}

export interface CoverageRow {
  readonly change: string;
  readonly title: string;
  readonly tests: readonly string[];
  readonly byLevel: Readonly<Record<string, readonly string[]>>;
  readonly envs: readonly NonNullable<Test['env']>[];
  readonly gaps: readonly Gap[];
}

export interface Coverage {
  readonly levels: readonly Test['level'][];
  readonly rows: readonly CoverageRow[];
  readonly gaps: {
    readonly untested: readonly string[];
    readonly unitOnly: readonly string[];
    readonly noE2e: readonly string[];
    readonly provesWithoutWalking: readonly { readonly test: string; readonly change: string }[];
    readonly connectionsWithoutContract: readonly UncontractedLink[];
  };
}

export interface CoverageQueries {
  readonly touchedBy: (chgId: string) => Set<string>;
  readonly coverage: () => Coverage;
  readonly spans: (flowId: string, mode?: string) => SpanBracket[];
  readonly testsProving: (chgId: string) => Test[];
  readonly walkedBy: (t: Test) => Set<string>;
  readonly connectionsWithoutContract: () => UncontractedLink[];
}

function rowOf(core: Core, c: Core['changes'][number]): CoverageRow {
  const ts = core.tests.filter((t) => t.proves.includes(c.id));
  const byLevel = Object.fromEntries(
    TEST_LEVELS.map((l) => [l, ts.filter((t) => t.level === l).map((t) => t.id)]),
  );
  return {
    change: c.id,
    title: c.title,
    tests: ts.map((t) => t.id),
    byLevel,
    envs: uniq(ts.map((t) => t.env)),
    gaps: gapsOf(ts, byLevel),
  };
}

/** The bracket a test makes over a flow's steps: the whole flow, or from its first to its last walked step. */
function spanOf(ids: readonly string[], flowId: string, t: Test): SpanBracket | undefined {
  const walks = t.walks ?? [];
  const whole = walks.includes(flowId);
  const idx = walks.map((w) => ids.indexOf(w)).filter((i) => i >= 0);
  if (!whole && idx.length === 0) return undefined;
  const [lo, hi] = whole ? [0, ids.length - 1] : [Math.min(...idx), Math.max(...idx)];
  if (hi < 0) return undefined;
  return {
    test: t.id,
    level: t.level,
    from: ids[lo],
    to: ids[hi],
    fromIndex: lo,
    toIndex: hi,
    whole,
  };
}

/** Tests against changes: what a change touches, what a test walks, and where the gaps are. */
export function createCoverage(core: Core): CoverageQueries {
  const { connectionsWithoutContract } = createContracts(core);
  const testsProving = memo((chgId: string) => core.tests.filter((t) => t.proves.includes(chgId)));
  const touchedBy = memo((chgId: string) => touchedByChange(core, chgId));

  const coverage = memo((): Coverage => {
    const rows = core.changes.map((c) => rowOf(core, c));
    const gapsFor = (g: Gap): string[] =>
      rows.filter((r) => r.gaps.includes(g)).map((r) => r.change);
    return {
      levels: [...TEST_LEVELS],
      rows,
      gaps: {
        untested: gapsFor('untested'),
        unitOnly: gapsFor('unit-only'),
        noE2e: gapsFor('no-e2e'),
        provesWithoutWalking: provesWithoutWalking(core, touchedBy),
        connectionsWithoutContract: connectionsWithoutContract(),
      },
    };
  });

  /** Test brackets over a flow's steps, widest first. */
  const spans = memo((flowId: string, mode: string | undefined = 'toBe'): SpanBracket[] => {
    const flow = core.graphOf(mode).get(flowId) ?? core.sys(flowId);
    if (flow?.$type !== 'flow') return [];
    const ids = flow.steps.map((s) => s.id);
    const brackets = core.tests.map((t) => spanOf(ids, flowId, t));
    return brackets
      .filter((b) => b !== undefined)
      .toSorted((a, b) => tie(a.fromIndex - b.fromIndex, b.toIndex - a.toIndex));
  });

  return {
    touchedBy,
    coverage,
    spans,
    testsProving,
    walkedBy: (t: Test) => walkedBy(core, t),
    connectionsWithoutContract,
  };
}
