import {
  checkProvides,
  checkReadsAndCaches,
  checkRequires,
  checkResolvers,
  checkValueType,
  fieldAt,
} from '@/application/plan/check-federation-fields';
import type { Scope } from '@/application/plan/check-federation-scope';
import {
  BUILTIN_SCALARS,
  fieldLabel,
  graphIndex,
  isKeyField,
  keysOf,
} from '@/application/plan/federation-index';
import { parseTypeRef } from '@/application/plan/federation-parse';
import type { FieldNode, SchemaNode } from '@/domain/plan/plan-graph';

const GRAPH_FIELD_PROPS = [
  'args',
  'subgraphs',
  'shareable',
  'provides',
  'requires',
  'override',
  'reads',
  'via',
  'cache',
  'cache_control',
  'auth',
  'batched',
  'usage',
];

/** `graph|TypeName` to the fields that return a type nobody modelled. */
export type Unknown = ReadonlyMap<string, readonly FieldNode[]>;

/** A field of a plain schema may not carry what only a graph-type field has. */
function checkPlainSchema(s: Scope, t: SchemaNode): void {
  if (!s.toBe) return;
  for (const f of t.fields) {
    const props = new Map<string, unknown>(Object.entries(f));
    const bad = GRAPH_FIELD_PROPS.filter(
      (k) => props.get(k) !== undefined && props.get(k) !== null,
    );
    if (bad.length > 0 && s.fresh(f.id)) {
      s.error(
        s.at(f),
        `${f.id} carries ${bad.join(', ')}, which only fields of a kind: graph-type schema have; delete them, or add the field to the graph type`,
      );
    }
  }
}

function checkKeys(s: Scope, t: SchemaNode): void {
  for (const [i, k] of keysOf(t).entries()) {
    for (const [j, fn] of k.fields.entries()) {
      if (t.fields.some((f) => f.name === fn)) continue;
      s.error(
        s.at(t, 'keys', ['keys', i, 'fields', j]),
        `${t.name} has no field ${fn}; a key names fields of its type`,
      );
    }
    for (const [j, sid] of k.in.entries()) {
      const sg = s.g.get(sid);
      if (sg?.$type !== 'subgraph' || sg.graph === t.graph) continue;
      s.error(
        s.at(t, 'keys', ['keys', i, 'in', j]),
        `${sid} belongs to ${sg.graph}, not ${String(t.graph)}; a key's in lists subgraphs of the type's graph`,
      );
    }
  }
}

/** An entity that several subgraphs contribute to needs keys. */
function checkMissingKeys(s: Scope, t: SchemaNode): void {
  const owners = [...new Set(t.fields.flatMap((f) => f.subgraphs ?? []))];
  const shapes = new Set(
    t.fields
      .filter((f) => !isKeyField(t, f.name))
      .map((f) => (f.subgraphs ?? []).toSorted((a, b) => a.localeCompare(b)).join(',')),
  );
  if (t.root !== undefined || keysOf(t).length > 0 || owners.length < 2 || shapes.size < 2) return;
  s.error(
    s.at(t, 'keys', []),
    `${t.name} has fields resolved by ${owners.join(', ')} but no keys; an entity that two or more subgraphs contribute to needs keys: [{ fields: [id], in: [${owners.join(', ')}] }]`,
  );
}

/** The `graph|type` key of a field's type when that type is not modelled, else null. */
function unknownKey(at: {
  readonly s: Scope;
  readonly t: SchemaNode;
  readonly f: FieldNode;
}): string | null {
  const { s, t, f } = at;
  const tn = parseTypeRef(f.type).name;
  if (tn === '' || BUILTIN_SCALARS.includes(tn) || graphIndex(s.g, t.graph).types.has(tn)) {
    return null;
  }
  return `${String(t.graph)}|${tn}`;
}

/** Checks 16: graph types: keys, ownership and the composition rules. */
export function checkGraphTypes(s: Scope): void {
  const unknown = new Map<string, readonly FieldNode[]>();
  for (const t of s.g.schemas) {
    if (t.kind !== 'graph-type') {
      checkPlainSchema(s, t);
      continue;
    }
    checkKeys(s, t);
    checkMissingKeys(s, t);
    for (const f of t.fields) {
      const a = fieldAt(s, t, f);
      checkResolvers(a);
      checkRequires(a);
      checkProvides(a);
      checkValueType(a);
      checkReadsAndCaches(a);
      const key = unknownKey({ s, t, f });
      if (key !== null) unknown.set(key, [...(unknown.get(key) ?? []), f]);
    }
  }
  reportUnknown(s, unknown);
}

function reportUnknown(s: Scope, unknown: Unknown): void {
  for (const [key, fs] of unknown) {
    const [first] = fs;
    if (fs.length < 2 || first === undefined) continue;
    const [gid = '', tn = ''] = key.split('|');
    const where = { ...s.at(first, 'type'), id: `${gid}#${tn}` };
    s.warn(
      where,
      `${tn} is used by ${String(fs.length)} fields of ${gid} (${fs.map((f) => fieldLabel(s.g, f.id)).join(', ')}) but is not modelled; the planner treats it as a scalar. Add a kind: graph-type schema named ${tn} if it has fields`,
    );
  }
}
