import { createContracts } from '@/application/plan/derive-contracts';
import type { Core } from '@/application/plan/derive-core';
import { memo, str, tie, uniq } from '@/application/plan/derive-values';
import { parentOf, prop, strings, typeOf } from '@/application/plan/ids';
import type { OpRecord, SystemGraph } from '@/domain/plan/plan-graph';
import { TEST_LEVELS } from '@/domain/plan/plan-vocab';
import type { Test } from '@/domain/plan/plan.generated';

interface SpanBracket {
  test: string;
  level: Test['level'];
  from: string | undefined;
  to: string | undefined;
  fromIndex: number;
  toIndex: number;
  whole: boolean;
}

type Gap = 'untested' | 'unit-only' | 'no-e2e';

interface Touch {
  core: Core;
  graphs: SystemGraph[];
  out: Set<string>;
  entities: Set<string>;
}

const graphsOf = (core: Core): SystemGraph[] => [core.asIs, core.toBe];

const stepsOfFlow = (graphs: SystemGraph[], flow: string): string[] =>
  graphs.flatMap((g) => {
    const f = g.get(flow);
    return f?.$type === 'flow' ? f.steps.map((s) => s.id) : [];
  });

const addAll = (into: Set<string>, ids: Iterable<string>): void => {
  for (const id of ids) into.add(id);
};

/** Retiring a service touches every step it acts in, or that fans out to it. */
function retire(t: Touch, id: string): void {
  for (const g of t.graphs) {
    const hit = g.steps.filter(
      (s) => s.from === id || s.to === id || t.core.fanout(g, s).services.includes(id),
    );
    addAll(
      t.out,
      hit.map((s) => s.id),
    );
  }
}

function touchId(t: Touch, r: OpRecord, id: string): void {
  const type = typeOf(id);
  const retiring = r.kind === 'remove' || r.kind === 'deprecate';
  if (type === 'step' || type === 'flow') {
    t.out.add(id);
    // a whole flow deprecated or removed touches every step in it
    if (type === 'flow') addAll(t.out, stepsOfFlow(t.graphs, id));
  } else if (type === 'service' && retiring) {
    retire(t, id);
  } else if (!retiring) {
    t.entities.add(id);
    const p = parentOf(id);
    if (p !== null && p !== '') t.entities.add(p);
  }
}

const movedIn = (p: OpRecord['props'][number]): (string | undefined)[] => [
  ...strings(p.before),
  ...strings(p.after),
  str(prop(p.before, 'from')),
  str(prop(p.after, 'from')),
];

/** A graph field moving between subgraphs touches the steps that reach either side. */
function touchMoved(t: Touch, r: OpRecord): void {
  const moved = r.props
    .filter((p) => p.prop === 'subgraphs' || p.prop === 'override')
    .flatMap((p) => movedIn(p));
  for (const x of moved) if (x !== undefined && typeOf(x) === 'subgraph') t.entities.add(x);
}

function touchRecord(t: Touch, r: OpRecord): void {
  for (const id of [r.target, ...r.ids]) if (id !== null) touchId(t, r, id);
  touchMoved(t, r);
  const parent = r.parent ?? '';
  if (r.kind === 'add' && r.type === 'step' && parent !== '') t.out.add(parent);
}

/** Steps (and flows) a change touches. */
function touchedByChange(core: Core, chgId: string): Set<string> {
  const t: Touch = { core, graphs: graphsOf(core), out: new Set(), entities: new Set() };
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
      if (refs.some((x) => t.entities.has(x) || t.entities.has(parentOf(x) ?? ''))) t.out.add(s.id);
    }
  }
  return t.out;
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
    out.add(w);
    addAll(out, stepsWalked(core, w));
  }
  return out;
}

const unwalked = (t: Test, walked: Set<string>, touchedBy: (id: string) => Set<string>) =>
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

function gapsOf(ts: Test[], byLevel: Record<string, string[]>): Gap[] {
  const gaps: Gap[] = [];
  if (ts.length === 0) gaps.push('untested');
  else if (ts.every((t) => t.level === 'unit')) gaps.push('unit-only');
  if (ts.length > 0 && (byLevel.e2e ?? []).length === 0) gaps.push('no-e2e');
  return gaps;
}

function rowOf(core: Core, c: Core['changes'][number]) {
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
function spanOf(ids: string[], flowId: string, t: Test): SpanBracket | undefined {
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
export function createCoverage(core: Core) {
  const { connectionsWithoutContract } = createContracts(core);
  const testsProving = memo((chgId: string) => core.tests.filter((t) => t.proves.includes(chgId)));
  const touchedBy = memo((chgId: string) => touchedByChange(core, chgId));

  const coverage = memo(() => {
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
