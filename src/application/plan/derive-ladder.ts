import type { Core } from '@/application/plan/derive-core';
import type { Delivery } from '@/application/plan/derive-delivery';
import type { Owners } from '@/application/plan/derive-owners';
import { memo, textOf, uniq } from '@/application/plan/derive-values';
import { formatPath, isRecord, prop, strings, typeOf, type Rec } from '@/application/plan/ids';
import type { OpRecord, PlanNode, StepNode } from '@/domain/plan/plan-graph';

type Rung = 'expand' | 'contract' | 'retire' | 'migrate';
type RungKind = 'expand' | 'migrate' | 'deprecate' | 'retire';

export interface LadderOp {
  readonly changeId: string | undefined;
  readonly opIndex: number;
  readonly path: string;
  readonly kind: OpRecord['kind'];
  readonly summary: string;
}

export interface LadderRung {
  readonly rung: 'expand' | 'migrate' | 'contract';
  readonly kind: RungKind;
  readonly label: string;
  readonly consumer?: string;
  readonly ops: readonly LadderOp[];
  readonly changes: readonly string[];
  readonly workItems: readonly string[];
  readonly teams: readonly string[];
}

/** The versions of a contract, oldest first, and the rungs of the ladder that moves people between them. */
export interface Ladder {
  readonly chain: readonly string[];
  readonly rungs: readonly LadderRung[];
  /** True only when a remove op retires an old version (a deprecate keeps it served). */
  readonly retired: boolean;
}

const chainLimit = 20;
interface StepEnds {
  readonly from: string | undefined;
  readonly to: string | undefined;
  readonly via: string | undefined;
}

interface LadderParts {
  readonly owners: Owners;
  readonly delivery: Delivery;
  readonly versions: (id: string) => { readonly replacedBy: string | null };
  readonly opSummary: (changeId: string | undefined, opIndex: number) => string;
}

function stepOf(v: unknown): StepEnds {
  const step: Rec = isRecord(v) ? v : {};
  return { from: textOf(step.from), to: textOf(step.to), via: textOf(step.via) };
}

const nonEmpty = (x: string | null | undefined): x is string => typeof x === 'string' && x !== '';

/** The versions an id is one of: what it supersedes, then what replaces it. */
function chainOf({ sys }: Core, versions: LadderParts['versions'], id: string): string[] {
  const chain = [id];
  let cur = textOf(prop(sys(id), 'supersedes'));
  for (let g = 0; nonEmpty(cur) && g < chainLimit; g++) {
    chain.unshift(cur);
    cur = textOf(prop(sys(cur), 'supersedes'));
  }
  let next = versions(id).replacedBy;
  for (let g = 0; nonEmpty(next) && !chain.includes(next) && g < chainLimit; g++) {
    chain.push(next);
    next = versions(next).replacedBy;
  }
  return chain;
}

interface Env {
  readonly core: Core;
  readonly isApi: boolean;
  readonly chain: readonly string[];
  readonly inChain: ReadonlySet<string>;
  readonly opSummary: LadderParts['opSummary'];
}

interface Placement {
  readonly rung: Rung;
  readonly consumer?: string | undefined;
}

const providerOf = ({ sys }: Core, vid: string): string | undefined => {
  const n = sys(vid);
  if (n?.$type === 'endpoint') return n.$service;
  return n?.$type === 'message' ? n.producer : undefined;
};

/** The service that adopts a version: the caller of an endpoint, the receiver of a message. */
const consumerOf = (
  env: Env,
  step: Pick<StepEnds, 'from' | 'to'> | undefined,
): string | undefined => (env.isApi ? step?.from : step?.to);

function addStepPlacement(env: Env, r: OpRecord): Placement {
  const v = stepOf(r.value);
  const producerSide = !env.isApi && v.from === providerOf(env.core, v.via ?? '');
  return producerSide ? { rung: 'expand' } : { rung: 'migrate', consumer: consumerOf(env, v) };
}

function modifyPlacements(env: Env, r: OpRecord): Placement[] {
  const target = r.target ?? '';
  const via = r.props.find(
    (p) =>
      p.prop === 'via' && (env.inChain.has(String(p.before)) || env.inChain.has(String(p.after))),
  );
  if (via !== undefined) {
    const node = env.core.sys(target);
    const step: StepNode | undefined = node?.$type === 'step' ? node : undefined;
    const producerSide = !env.isApi && step?.from === providerOf(env.core, String(via.after));
    return [
      producerSide ? { rung: 'contract' } : { rung: 'migrate', consumer: consumerOf(env, step) },
    ];
  }
  const cons = r.props.find((p) => p.prop === 'consumers' && env.inChain.has(target));
  if (cons !== undefined) {
    return strings(cons.values).map((consumer) => ({ rung: 'migrate', consumer }));
  }
  return env.inChain.has(target) ? [{ rung: 'expand' }] : [];
}

function addPlacements(env: Env, r: OpRecord): Placement[] {
  if (env.inChain.has(r.target ?? '') && r.target !== (env.chain.at(0) ?? null)) {
    return [{ rung: 'expand' }];
  }
  const stepOnChain = r.type === 'step' && env.inChain.has(stepOf(r.value).via ?? '');
  return stepOnChain ? [addStepPlacement(env, r)] : [];
}

function removePlacements(env: Env, r: OpRecord): Placement[] {
  const stepOnChain = r.type === 'step' && env.inChain.has(stepOf(r.removed).via ?? '');
  return env.inChain.has(r.target ?? '') || stepOnChain ? [{ rung: 'retire' }] : [];
}

/** Where an op sits on the ladder: it may start a rung, move a consumer, or close one. */
function placements(env: Env, r: OpRecord): Placement[] {
  switch (r.kind) {
    case 'add': {
      return addPlacements(env, r);
    }
    case 'modify': {
      return modifyPlacements(env, r);
    }
    case 'deprecate': {
      return env.inChain.has(r.target ?? '') ? [{ rung: 'contract' }] : [];
    }
    case 'remove': {
      return removePlacements(env, r);
    }
    default: {
      return [];
    }
  }
}

interface Collected {
  readonly rungs: Record<Exclude<Rung, 'migrate'>, readonly LadderOp[]>;
  readonly migrate: ReadonlyMap<string, readonly LadderOp[]>;
}

function collect(env: Env): Collected {
  const rungs: Record<Exclude<Rung, 'migrate'>, LadderOp[]> = {
    expand: [],
    contract: [],
    retire: [],
  };
  const migrate = new Map<string, readonly LadderOp[]>();
  for (const r of env.core.records) {
    for (const p of placements(env, r)) {
      const item: LadderOp = {
        changeId: r.changeId,
        opIndex: r.opIndex,
        path: formatPath(r.path),
        kind: r.kind,
        summary: env.opSummary(r.changeId, r.opIndex),
      };
      if (p.rung === 'migrate') {
        const key = p.consumer ?? '(unknown)';
        migrate.set(key, [...(migrate.get(key) ?? []), item]);
      } else rungs[p.rung].push(item);
    }
  }
  return { rungs, migrate };
}

/** Same-name versions collapse to "v1" / "v2"; otherwise full labels. */
function shortNamer(
  { sys, label }: Core,
  chain: readonly string[],
): (cid: string, i: number) => string {
  const nodes = chain.map((c) => sys(c));
  const first = textOf(prop(nodes[0], 'name'));
  const versionOf = (n: PlanNode | undefined): string | undefined => textOf(prop(n, 'version'));
  const sameName =
    nodes.every((n) => {
      const name = textOf(prop(n, 'name'));
      return name !== undefined && name === first && nonEmpty(versionOf(n));
    }) && new Set(nodes.map(versionOf)).size === nodes.length;
  const distinct = new Set(chain.map(label)).size === chain.length;
  return (cid, i) => {
    if (sameName) return versionOf(nodes[i]) ?? cid;
    return distinct ? label(cid) : cid;
  };
}

type Labeller = (kind: RungKind, consumer?: string) => string;

function labeller(core: Core, chain: readonly string[], isApi: boolean): Labeller {
  const short = shortNamer(core, chain);
  const old = chain.length > 1 ? chain.slice(0, -1).map(short).join(', ') : null;
  const newest = short(chain.at(-1) ?? '', chain.length - 1);
  const served = isApi ? 'served' : 'published';
  const consumerName = (c: string | undefined): string =>
    c !== undefined && c !== '(unknown)' ? core.label(c) : 'A consumer';
  return (kind, consumer) => {
    if (kind === 'expand') {
      return old === null ? `${newest} ${served}` : `${newest} ${served} next to ${old}`;
    }
    if (kind === 'migrate') {
      return `${consumerName(consumer)} ${old === null ? 'starts using' : 'moves to'} ${newest}`;
    }
    if (kind === 'deprecate') return `${old ?? newest} marked deprecated (still ${served})`;
    return `${old ?? newest} removed`;
  };
}

interface RungSpec {
  readonly rung: LadderRung['rung'];
  readonly kind: RungKind;
  readonly consumer?: string;
}

interface Rungs {
  readonly core: Core;
  readonly owners: Owners;
  readonly delivery: Delivery;
  readonly labelOf: Labeller;
}

function withOwners(env: Rungs, spec: RungSpec, ops: readonly LadderOp[]): LadderRung {
  const { rung, kind, consumer } = spec;
  const changes = uniq(ops.map((o) => o.changeId));
  const wis = env.core.workItems
    .filter((w) => w.implements.some((c) => changes.includes(c)))
    .map((w) => w.id);
  const teams = uniq([
    ...(consumer === undefined ? [] : [env.owners.ownerTeam(consumer)]),
    ...wis.map((w) => env.delivery.wiById.get(w)?.team),
  ]);
  return {
    rung,
    kind,
    label: env.labelOf(kind, consumer),
    ...(consumer === undefined ? {} : { consumer }),
    ops,
    changes,
    workItems: wis,
    teams,
  };
}

/**
 * expand → migrate (per consumer) → contract rungs for a versioned message or endpoint. A `deprecate` op is a
 * "marked deprecated (still served)" rung; only a `remove` op retires. Both have rung 'contract' (deprecate first).
 */
export function createLadder(core: Core, parts: LadderParts): (id: string) => Ladder {
  return memo((id: string): Ladder => {
    const chain = chainOf(core, parts.versions, id);
    const isApi = typeOf(id) === 'endpoint';
    const { rungs, migrate } = collect({
      core,
      isApi,
      chain,
      inChain: new Set(chain),
      opSummary: parts.opSummary,
    });
    const env: Rungs = {
      core,
      owners: parts.owners,
      delivery: parts.delivery,
      labelOf: labeller(core, chain, isApi),
    };
    return {
      chain,
      rungs: [
        withOwners(env, { rung: 'expand', kind: 'expand' }, rungs.expand),
        ...[...migrate].map(([consumer, ops]) =>
          withOwners(env, { rung: 'migrate', kind: 'migrate', consumer }, ops),
        ),
        withOwners(env, { rung: 'contract', kind: 'deprecate' }, rungs.contract),
        withOwners(env, { rung: 'contract', kind: 'retire' }, rungs.retire),
      ].filter((r) => r.ops.length > 0),
      /** True only when a remove op retires an old version (a deprecate keeps it served). */
      retired: rungs.retire.length > 0,
    };
  });
}
