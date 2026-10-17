import type { Core } from '@/application/plan/derive-core';
import type { Delivery } from '@/application/plan/derive-delivery';
import type { LadderOp } from '@/application/plan/derive-ladder';
import type { Owners } from '@/application/plan/derive-owners';
import { memo, textOf, uniq } from '@/application/plan/derive-values';
import { formatPath, isRecord, prop, strings } from '@/application/plan/ids';
import type { OpRecord, PropChange } from '@/domain/plan/plan-graph';

type FieldKind = 'expand' | 'migrate' | 'retire';

export interface FieldRung {
  readonly rung: 'expand' | 'migrate' | 'contract';
  readonly kind: FieldKind;
  readonly label: string;
  /** Only a message or endpoint ladder names the consumer a rung migrates. */
  readonly consumer?: undefined;
  /** The share of requests the new subgraph takes (expand, migrate). */
  readonly percent?: number | null;
  /** The rollout steps the change authors for a progressive override ("10 % → 50 % → 100 %"). */
  readonly steps?: readonly number[];
  readonly ops: readonly LadderOp[];
  readonly changes: readonly string[];
  readonly workItems: readonly string[];
  readonly teams: readonly string[];
}

/** A graph field moving between subgraphs through @override: expand → migrate → contract. */
export interface FieldLadder {
  readonly chain: readonly string[];
  readonly from: string | null;
  readonly to: string | null;
  readonly rungs: readonly FieldRung[];
  readonly retired: boolean;
}

interface FieldLadderParts {
  readonly owners: Owners;
  readonly delivery: Delivery;
  readonly opSummary: (changeId: string | undefined, opIndex: number) => string;
}

interface Ends {
  readonly from: string | null;
  readonly to: string | null;
}

interface Move {
  readonly kind: FieldKind | null;
  readonly gained: readonly string[];
  readonly lost: readonly string[];
  readonly ov: PropChange | undefined;
  /** Where the override sends the field from, when the op sets one. */
  readonly ovFrom: string | null;
  readonly percent: number | null;
}

const PERCENT = /\d{1,3} {0,2}%/gu;

const without = (list: unknown, other: unknown): string[] =>
  strings(list).filter((x) => !strings(other).includes(x));

function kindOf(m: Pick<Move, 'gained' | 'lost' | 'ov'>): FieldKind | null {
  const { gained, lost, ov } = m;
  const after = ov?.after;
  const had = ov !== undefined && isRecord(ov.before);
  if (lost.length > 0 || (had && (after === null || after === undefined))) return 'retire';
  if (gained.length > 0 || (ov !== undefined && !had && isRecord(after))) return 'expand';
  return ov === undefined ? null : 'migrate';
}

function percentOf(ov: PropChange | undefined): number | null {
  const given = prop(ov?.after, 'percent');
  if (typeof given === 'number') return given;
  return isRecord(ov?.after) ? 100 : null;
}

function moveOf(r: OpRecord): Move {
  const sgs = r.props.find((p) => p.prop === 'subgraphs');
  const ov = r.props.find((p) => p.prop === 'override');
  const gained = sgs === undefined ? [] : without(sgs.after, sgs.before);
  const lost = sgs === undefined ? [] : without(sgs.before, sgs.after);
  return {
    kind: kindOf({ gained, lost, ov }),
    gained,
    lost,
    ov,
    ovFrom: textOf(prop(ov?.after, 'from')) ?? null,
    percent: percentOf(ov),
  };
}

/** Where the field moves from and to after this op. */
function nextEnds(env: { readonly core: Core; readonly id: string }, m: Move, ends: Ends): Ends {
  const from = m.ovFrom ?? ends.from;
  let to = ends.to;
  if (m.gained.length > 0) to = m.gained[0] ?? null;
  else if (m.ovFrom !== null && to === null) {
    to = strings(prop(env.core.sys(env.id), 'subgraphs')).find((x) => x !== m.ovFrom) ?? null;
  }
  return { from: m.kind === 'retire' ? (from ?? m.lost[0] ?? null) : from, to };
}

/** The first "10 % → 50 % → 100 %" chain in a change's rollout text. */
function rolloutSteps(core: Core, changeId: string | undefined): readonly number[] {
  const text = (textOf(prop(core.planIndex.get(changeId ?? ''), 'rollout')) ?? '').replaceAll(
    '->',
    '→',
  );
  const chains: { readonly end: number; readonly steps: readonly number[] }[] = [];
  for (const m of text.matchAll(PERCENT)) {
    const last = chains.at(-1);
    const joined = last !== undefined && text.slice(last.end, m.index).trim() === '→';
    const step = Number.parseInt(m[0], 10);
    const end = m.index + m[0].length;
    if (joined) chains[chains.length - 1] = { end, steps: [...last.steps, step] };
    else chains.push({ end, steps: [step] });
  }
  return chains.find((c) => c.steps.length > 1)?.steps ?? [];
}

interface LabelFacts {
  readonly name: string;
  readonly ends: Ends;
  readonly move: Move;
  readonly steps: readonly number[];
}

function labelOf(core: Core, kind: FieldKind, f: LabelFacts): string {
  const at = (id: string | null): string => (id === null ? '' : core.label(id));
  const { name, ends, move, steps } = f;
  if (kind === 'retire') {
    return `${at(ends.from)} stops resolving ${name}; ${at(ends.to)} has all of it`;
  }
  if (kind === 'migrate') {
    const share =
      steps.length > 1
        ? steps.map((x) => `${String(x)} %`).join(' → ')
        : `${String(move.percent ?? 100)} %`;
    return `${at(ends.to)} takes ${share} of ${name}`;
  }
  const next = ends.from === null ? '' : ` next to ${at(ends.from)}`;
  const override =
    ends.from !== null && move.percent !== null ? ` (override ${String(move.percent)} %)` : '';
  return `${at(ends.to)} serves ${name}${next}${override}`;
}

function rungOf(
  env: { readonly core: Core; readonly parts: FieldLadderParts },
  r: OpRecord,
  facts: LabelFacts & { readonly kind: FieldKind },
): FieldRung {
  const { core, parts } = env;
  const { kind, ends, move, steps } = facts;
  const wis = core.workItems
    .filter((w) => w.implements.includes(r.changeId ?? ''))
    .map((w) => w.id);
  const side = kind === 'retire' ? ends.from : ends.to;
  const op: LadderOp = {
    changeId: r.changeId,
    opIndex: r.opIndex,
    path: formatPath(r.path),
    kind: r.kind,
    summary: parts.opSummary(r.changeId, r.opIndex),
  };
  return {
    rung: kind === 'retire' ? 'contract' : kind,
    kind,
    label: labelOf(core, kind, facts),
    ...(kind === 'retire' ? {} : { percent: move.percent }),
    ...(steps.length > 1 ? { steps } : {}),
    ops: [op],
    changes: r.changeId === undefined ? [] : [r.changeId],
    workItems: wis,
    teams: uniq([
      side === null ? null : parts.owners.ownerTeam(side),
      ...wis.map((w) => parts.delivery.wiById.get(w)?.team),
    ]),
  };
}

function ladderOf(core: Core, parts: FieldLadderParts, id: string): FieldLadder {
  const name = textOf(prop(core.sys(id), 'name')) ?? id.split('#')[1] ?? id;
  const rungs: FieldRung[] = [];
  let ends: Ends = { from: null, to: null };
  for (const r of core.records.filter((x) => x.kind === 'modify' && x.target === id)) {
    const move = moveOf(r);
    ends = nextEnds({ core, id }, move, ends);
    if (move.kind === null) continue;
    const steps = move.kind === 'migrate' ? rolloutSteps(core, r.changeId) : [];
    rungs.push(rungOf({ core, parts }, r, { kind: move.kind, name, ends, move, steps }));
  }
  return { chain: [id], ...ends, rungs, retired: rungs.some((x) => x.kind === 'retire') };
}

/** Whether an op moves the field between subgraphs: the ladder of a graph field is then this one. */
function movesField(core: Core, id: string): boolean {
  return core.records.some(
    (r) =>
      r.target === id &&
      r.kind === 'modify' &&
      r.props.some((p) => p.prop === 'override' || p.prop === 'subgraphs'),
  );
}

export interface FieldLadders {
  readonly fieldLadder: (id: string) => FieldLadder;
  readonly movesField: (id: string) => boolean;
}

export function createFieldLadder(core: Core, parts: FieldLadderParts): FieldLadders {
  const fieldLadder = memo((id: string): FieldLadder => ladderOf(core, parts, id));
  return { fieldLadder, movesField: (id: string): boolean => movesField(core, id) };
}
