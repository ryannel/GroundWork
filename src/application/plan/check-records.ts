import {
  blame,
  scoped,
  touched,
  whereAt,
  type CheckContext,
  type Report,
} from '@/application/plan/check-context';
import { serviceLinks } from '@/application/plan/graph-queries';
import type { FieldNode, SchemaNode, SystemGraph, SystemNode } from '@/domain/plan/plan-graph';
import type { PathSegment } from '@/domain/plan/plan-ids';

const NEEDS_STORE = 'add `store: st:…` to the schema, or change its kind to dto or payload';
const isTopic = (kind: string): boolean => kind === 'topic' || kind === 'queue';

function checkRecordStores(ctx: CheckContext, rep: Report): void {
  for (const { g, list } of scoped(ctx, (x) => x.schemas)) {
    for (const sch of list) {
      if (sch.kind !== 'record' || sch.store !== undefined) continue;
      const fresh = g === ctx.asIs && !touched(ctx, sch.id);
      rep.err(
        fresh ? [...sch.$path, 'store'] : blame(ctx, sch.id, 'kind'),
        `${sch.id} is a record, so it needs a store; ${NEEDS_STORE}`,
      );
    }
  }
}

function checkMessageTopics(ctx: CheckContext, rep: Report): void {
  for (const { g, list } of scoped(ctx, (x) => x.messages)) {
    for (const m of list) {
      const topic = g.get(m.topic);
      if (topic?.$type === 'store' && !isTopic(topic.kind)) {
        rep.warn(
          blame(ctx, m.id, 'topic'),
          `${m.topic} is a ${topic.kind}; a message topic should be a topic or queue store — point topic at a kind: topic or queue store`,
        );
      }
    }
  }
}

function checkTopicsCarry(ctx: CheckContext, rep: Report): void {
  for (const { g, list } of scoped(ctx, (x) => x.stores)) {
    for (const st of list) {
      if (!isTopic(st.kind) || g.messages.some((m) => m.topic === st.id)) continue;
      rep.warn(
        whereAt({ ctx, g }, st, { prop: 'kind', rel: [] }),
        `${st.id} is a ${st.kind} but no message says what goes on it; add a messages[] entry with topic: ${st.id}, its producer, consumers and payload schema`,
      );
    }
  }
}

/** Check 4: records need a store; topics and queues carry messages. */
export function checkRecords(ctx: CheckContext, rep: Report): void {
  checkRecordStores(ctx, rep);
  checkMessageTopics(ctx, rep);
  checkTopicsCarry(ctx, rep);
}

const typeBase = (t: string): string => t.trim().replace(/\?$/, '');

interface FieldScope {
  ctx: CheckContext;
  rep: Report;
  g: SystemGraph;
}

function checkFieldRef(s: FieldScope, f: FieldNode, at: (prop: string) => PathSegment[]): void {
  const target =
    f.ref === undefined
      ? undefined
      : (s.g.get(f.ref) ?? s.ctx.toBe.get(f.ref) ?? s.ctx.asIs.get(f.ref));
  if (target?.$type === 'field' && typeBase(f.type) !== typeBase(target.type)) {
    s.rep.warn(
      at('ref'),
      `${f.id} (${f.type}) points at ${String(f.ref)} (${target.type}); the two should have the same type`,
    );
  }
}

function checkFieldFacts(s: FieldScope, sch: SchemaNode): void {
  for (const [i, f] of sch.fields.entries()) {
    const at = (prop: string): PathSegment[] =>
      whereAt(s, sch, { prop: 'fields', rel: ['fields', i, prop] });
    if (f.key === true && sch.kind !== 'record') {
      s.rep.warn(
        at('key'),
        `${f.id} has key, but ${sch.id} is a ${sch.kind}, and only a record has a key; remove key, or make the schema a record`,
      );
    }
    if (f.default !== undefined && f.required === false) {
      s.rep.warn(
        at('default'),
        `${f.id} has a default but is optional, so the default is never used; remove default, or make the field required`,
      );
    }
    if (/\?\s*$/.test(f.type) && f.required === true) {
      s.rep.warn(
        at('type'),
        `${f.id} is typed ${f.type} (optional) but marked required; drop the "?" or set required: false`,
      );
    }
    checkFieldRef(s, f, at);
  }
}

/** Check 4b: the optional field facts (key, default, `?` against required, ref types). */
export function checkFields(ctx: CheckContext, rep: Report): void {
  for (const { g, list } of scoped(ctx, (x) => x.schemas)) {
    for (const sch of list) if (sch.kind !== 'graph-type') checkFieldFacts({ ctx, rep, g }, sch);
  }
}

function stageOfServices(ctx: CheckContext): Map<string, string> {
  const out = new Map<string, string>();
  for (const stg of ctx.plan.domain?.stages ?? []) {
    for (const x of stg.services ?? []) if (!out.has(x.svc)) out.set(x.svc, stg.id);
  }
  return out;
}

interface SystemScope extends FieldScope {
  stageOf: ReadonlyMap<string, string>;
}

function checkSystem(s: SystemScope, sys: SystemNode): void {
  const at = (prop: string): PathSegment[] => whereAt(s, sys, prop);
  const members = s.g.services.filter((m) => m.system === sys.id);
  if (members.length < 2) {
    s.rep.warn(
      at('id'),
      `${sys.id} has ${members.length > 0 ? 'only one service' : 'no services'}; a system groups two or more services of one team (set system: ${sys.id} on each), else drop it and keep the service on its own`,
    );
  }
  for (const m of members.filter((x) => x.team !== sys.team)) {
    s.rep.err(
      whereAt(s, m, 'system'),
      `${m.id} (team ${m.team}) is in ${sys.id} (team ${sys.team}); a system belongs to one team, so drop system from ${m.id} or fix its team`,
    );
  }
  const stages = [...new Set(members.flatMap((m) => s.stageOf.get(m.id) ?? []))];
  if (stages.length > 1) {
    s.rep.warn(
      at('id'),
      `the services of ${sys.id} sit in different stages (${stages.join(', ')}); the map draws a system as one card in one column, so list them all in one stage`,
    );
  }
  if (s.g === s.ctx.asIs && (sys.sources ?? []).length === 0) {
    s.rep.warn(
      at('sources'),
      `${sys.id} has no sources; link the code that makes them one system (the shared repo or solution, the shared private store, or the one calling the other as its only caller); a Backstage spec.system line alone is a weak hint`,
    );
  }
}

/** Check 13: one card per system, every service on a line of the system map. */
export function checkSystems(ctx: CheckContext, rep: Report): void {
  const stageOf = stageOfServices(ctx);
  for (const { g, list } of scoped(ctx, (x) => x.systems)) {
    for (const sys of list) checkSystem({ ctx, rep, g, stageOf }, sys);
  }
}

/** Check 13b: every service has a line on the system map. */
export function checkMapLines(ctx: CheckContext, rep: Report): void {
  const stages = ctx.plan.domain?.stages ?? [];
  if (stages.length === 0) return;
  const links = serviceLinks(ctx.asIs, stages, ctx.fanout);
  const linked = new Set(links.flatMap((l) => [l.from, l.to]));
  for (const s of ctx.asIs.services) {
    if (s.kind === 'external' || linked.has(s.id)) continue;
    rep.warn(
      [...s.$path, 'id'],
      `${s.id} has no line on the system map: it calls nothing, nothing calls it, and it shares no topic or store with another service; add what it calls or reads from (a flow step or stage from:), the topics it writes and who reads them (store access, messages), or drop it if it is not part of this story`,
    );
  }
}
