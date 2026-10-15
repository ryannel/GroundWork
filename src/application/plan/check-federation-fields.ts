import { opRef } from '@/application/plan/check-context';
import type { Scope } from '@/application/plan/check-federation-scope';
import {
  fieldLabel,
  graphIndex,
  type GraphIndex,
  isKeyField,
  keyIns,
  keysOf,
} from '@/application/plan/federation-index';
import { parseTypeRef } from '@/application/plan/federation-parse';
import type { FieldNode, SchemaNode } from '@/domain/plan/plan-graph';

/** A graph-type field, with what its checks share. */
export interface FieldAt {
  s: Scope;
  t: SchemaNode;
  f: FieldNode;
  idx: GraphIndex;
  name: string;
  subs: string[];
  /** The returned graph type, when it is modelled. */
  ret: SchemaNode | null;
}

export function fieldAt(s: Scope, t: SchemaNode, f: FieldNode): FieldAt {
  const idx = graphIndex(s.g, t.graph);
  return {
    s,
    t,
    f,
    idx,
    name: fieldLabel(s.g, f.id),
    subs: f.subgraphs ?? [],
    ret: idx.types.get(parseTypeRef(f.type).name) ?? null,
  };
}

function checkSubgraph(a: FieldAt, sid: string, j: number): void {
  const { s, t, f, name } = a;
  const sg = s.g.get(sid);
  const where = s.at(f, 'subgraphs', ['subgraphs', j]);
  if (sg?.$type === 'subgraph' && sg.graph !== t.graph) {
    s.error(
      where,
      `${sid} belongs to ${sg.graph}, but ${t.name} is a type of ${String(t.graph)}; list subgraphs of ${String(t.graph)}`,
    );
  }
  const retired = s.ctx.deprecatedBy.get(sid);
  if (s.toBe && retired !== undefined) {
    s.warn(
      where,
      `${name} is still resolved by ${sid}, which ${opRef(retired)} deprecates; move the field (append the new subgraph with override, then drop ${sid})`,
    );
  }
  const unkeyed = keysOf(t).length > 0 && !isKeyField(t, f.name) && !keyIns(t, null).includes(sid);
  if (unkeyed && sg?.$type === 'subgraph') {
    s.error(
      where,
      `${sid} resolves ${name} but is in none of ${t.name}'s keys, so the gateway cannot ask it for a ${t.name}; add ${sid} to a key's in`,
    );
  }
}

/** Which subgraphs resolve it, and whether they agree to share it. */
export function checkResolvers(a: FieldAt): void {
  const { s, t, f, name, subs } = a;
  if (!isKeyField(t, f.name) && subs.length === 0) {
    s.error(
      s.at(f),
      `${name} has no subgraphs; say which subgraph resolves it (subgraphs: [sg:…]); only key fields may leave it out`,
    );
  }
  for (const [j, sid] of subs.entries()) checkSubgraph(a, sid, j);
  if (subs.length >= 2 && f.shareable !== true && (f.override ?? null) === null) {
    s.error(
      s.at(f, 'subgraphs'),
      `${name} is resolved by ${subs.join(' and ')}; composition needs shareable: true, or override: { from: … } while it moves between them`,
    );
  }
  const from = f.override?.from;
  if (from !== undefined && from !== '' && !subs.includes(from)) {
    s.error(
      s.at(f, 'override'),
      `${name} overrides ${from}, which does not resolve it; keep ${from} in subgraphs while the field moves, and set override: null once it is dropped`,
    );
  }
}

/** @requires names fields another subgraph resolves. */
export function checkRequires({ s, f, name, subs }: FieldAt): void {
  for (const [j, rid] of (f.requires ?? []).entries()) {
    const rf = s.g.get(rid);
    if (rf?.$type !== 'field') continue;
    const rt = s.g.get(rf.$parent);
    const holder = rt?.$type === 'schema' ? rt : null;
    const viaKey = keysOf(holder).some((k) => k.fields.includes(rf.name));
    const resolvers = [
      ...new Set([...(rf.subgraphs ?? []), ...(viaKey ? keyIns(holder, null) : [])]),
    ];
    if (!resolvers.some((x) => !subs.includes(x))) {
      s.error(
        s.at(f, 'requires', ['requires', j]),
        `${name} requires ${rid}, but only its own subgraph resolves that; @requires names fields another subgraph resolves (drop it, or resolve the field yourself)`,
      );
    }
  }
}

/** @provides names fields of the type the field returns, which its subgraph does not already resolve everywhere. */
export function checkProvides({ s, f, name, subs, ret }: FieldAt): void {
  for (const [j, pid] of (f.provides ?? []).entries()) {
    const where = s.at(f, 'provides', ['provides', j]);
    if (ret === null || pid.split('#')[0] !== ret.id) {
      s.error(
        where,
        `${name} provides ${pid}, which is not a field of ${ret?.name ?? parseTypeRef(f.type).name}; @provides names fields of the type the field returns`,
      );
    }
    const tf = s.g.get(pid);
    const dup = tf?.$type === 'field' ? subs.filter((x) => (tf.subgraphs ?? []).includes(x)) : [];
    if (tf?.$type === 'field' && dup.length > 0) {
      const them = dup.join(', ');
      const target = fieldLabel(s.g, tf.id);
      s.warn(
        where,
        `redundant @provides: ${them} already resolves ${target} everywhere, so ${name} providing it changes nothing; drop ${them} from ${target}.subgraphs (it is @external there and only resolves it on the provided path), or drop the provides`,
      );
    }
  }
}

/** A value type (no keys) is defined in every subgraph that returns it. */
export function checkValueType({ s, f, name, subs, ret }: FieldAt): void {
  if (ret === null || keysOf(ret).length > 0 || ret.root !== undefined) return;
  const foreign = ret.fields.filter((rf) => {
    const rs = rf.subgraphs ?? [];
    return rs.length > 0 && subs.length > 0 && !rs.some((x) => subs.includes(x));
  });
  if (foreign.length === 0) return;
  const names = foreign.map((x) => x.name).join(', ');
  const verb = foreign.length > 1 ? 'are' : 'is';
  const by = [...new Set(foreign.flatMap((x) => x.subgraphs ?? []))].join(', ');
  s.warn(
    s.at(f, 'type'),
    `${ret.name} is returned by ${name} (${subs.join(', ')}) but ${names} ${verb} resolved by ${by}; a value type is defined in every subgraph that returns it, so list ${subs.join(', ')} on ${ret.name}'s fields (shareable: true)`,
  );
}

/** reads names record fields; a cache layer names a cache store. */
export function checkReadsAndCaches({ s, f, name }: FieldAt): void {
  for (const [j, rid] of (f.reads ?? []).entries()) {
    const rs = s.g.get(rid.split('#')[0]);
    if (rs?.$type === 'schema' && rs.kind === 'graph-type') {
      s.error(
        s.at(f, 'reads', ['reads', j]),
        `${name} reads ${rid}, a graph type; reads names the record fields behind the resolver`,
      );
    }
  }
  for (const [j, c] of (f.cache ?? []).entries()) {
    const st = s.g.get(c.at);
    if (st?.$type === 'store' && st.kind !== 'cache') {
      s.warn(
        s.at(f, 'cache', ['cache', j, 'at']),
        `${name} caches in ${c.at}, a ${st.kind}; cache[].at names a kind: cache store`,
      );
    }
  }
}
