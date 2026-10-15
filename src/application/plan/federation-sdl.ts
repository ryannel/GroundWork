import { graphIndex, type GraphIndex } from '@/application/plan/federation-index';
import { parseTypeRef } from '@/application/plan/federation-parse';
import { parentOf } from '@/application/plan/ids';
import type { FieldNode, SchemaNode, SystemGraph } from '@/domain/plan/plan-graph';

export interface SdlLine {
  text: string;
  kind: 'head' | 'field' | 'close' | 'blank';
  type: string | null;
  field: string | null;
}

export interface SdlOptions {
  /** A subgraph id: print the SDL that subgraph alone would hold. */
  only?: string | null;
}

const slugOf = (id: string): string => id.replace(/^sg:/, '');
const ESCAPED_QUOTE = String.raw`\"`;
const quoted = (s: string): string => `"${s.replaceAll('"', ESCAPED_QUOTE)}"`;

/** The field of `type` that returns the graph type `typeId`. */
const viaOf = (idx: GraphIndex, type: SchemaNode, typeId: string): FieldNode | undefined =>
  type.fields.find((f) => idx.types.get(parseTypeRef(f.type).name)?.id === typeId);

/** The `fields:` text of field ids on `type` or one level below it: "sku", "stock { fc }". */
function selectionText(g: SystemGraph, type: SchemaNode, ids: readonly string[]): string {
  const idx = graphIndex(g, type.graph);
  const own: string[] = [];
  const below = new Map<string, string[]>();
  for (const id of ids) {
    const owner = parentOf(id);
    const name = id.split('#')[1];
    if (owner === null || name === undefined || name === '') continue;
    if (owner === type.id) {
      if (!own.includes(name)) own.push(name);
      continue;
    }
    const via = viaOf(idx, type, owner);
    if (via !== undefined) below.set(via.name, [...(below.get(via.name) ?? []), name]);
  }
  const nested = [...below].map(([n, kids]) => `${n} { ${kids.join(' ')} }`);
  return [...own.filter((n) => !below.has(n)), ...nested].join(' ');
}

/** A required field is external to `t`, and so is the field of `t` that reaches its type. */
function addRequired(
  at: { idx: GraphIndex; t: SchemaNode },
  id: string,
  external: Set<string>,
): void {
  const { idx, t } = at;
  external.add(id);
  const owner = parentOf(id);
  const via = owner === null || owner === t.id ? undefined : viaOf(idx, t, owner);
  if (via !== undefined) external.add(via.id);
}

/** Fields another subgraph resolves that `only` still has to name: what it provides and requires. */
function externalOf(idx: GraphIndex, only: string): Set<string> {
  const external = new Set<string>();
  for (const t of idx.types.values()) {
    for (const f of t.fields.filter((x) => (x.subgraphs ?? []).includes(only))) {
      for (const id of f.provides ?? []) external.add(id);
      for (const id of f.requires ?? []) addRequired({ idx, t }, id, external);
    }
  }
  return external;
}

function overrideOf(f: FieldNode, only: string | null): string[] {
  const from = f.override?.from;
  if (from === undefined || from === '' || from === only) return [];
  const percent = f.override?.percent;
  const progressive = typeof percent === 'number' && percent < 100;
  const label = progressive ? `, label: "percent(${String(percent)})"` : '';
  return [`@override(from: ${quoted(slugOf(from))}${label})`];
}

interface Printing {
  g: SystemGraph;
  idx: GraphIndex | null;
  only: string | null;
}

function directives({ g, idx, only }: Printing, t: SchemaNode, f: FieldNode): string[] {
  const requires = f.requires ?? [];
  const provides = f.provides ?? [];
  const out: string[] = [];
  if (f.shareable === true) out.push('@shareable');
  if (requires.length > 0) out.push(`@requires(fields: ${quoted(selectionText(g, t, requires))})`);
  if (provides.length > 0) {
    const ret = idx?.types.get(parseTypeRef(f.type).name);
    const text =
      ret === undefined
        ? provides.map((x) => x.split('#')[1] ?? '').join(' ')
        : selectionText(g, ret, provides);
    out.push(`@provides(fields: ${quoted(text)})`);
  }
  return [...out, ...overrideOf(f, only)];
}

function fieldLine(p: Printing, t: SchemaNode, f: FieldNode): SdlLine {
  const owned = f.subgraphs ?? [];
  const mine = p.only === null || owned.includes(p.only);
  const d = mine ? directives(p, t, f) : ['@external'];
  const showOwner = (p.only === null || !mine) && owned.length > 0;
  const owner = showOwner ? `  # owned by ${owned.map(slugOf).join(', ')}` : '';
  const args = f.args === undefined || f.args === '' ? '' : `(${f.args})`;
  const tags = d.length > 0 ? ` ${d.join(' ')}` : '';
  const text = `  ${f.name}${args}: ${f.type}${tags}${owner}`;
  return { text, kind: 'field', type: t.id, field: f.id };
}

function typeLines(p: Printing, t: SchemaNode, external: ReadonlySet<string>): SdlLine[] {
  const { only } = p;
  const keys = (t.keys ?? []).filter((k) => only === null || k.in.includes(only));
  const keyNames = new Set(keys.flatMap((k) => k.fields));
  const shown = t.fields.filter(
    (f) =>
      only === null ||
      (f.subgraphs ?? []).includes(only) ||
      keyNames.has(f.name) ||
      external.has(f.id),
  );
  if (shown.length === 0) return [];
  const tags = keys.map((k) => ` @key(fields: ${quoted(k.fields.join(' '))})`).join('');
  return [
    { text: `type ${t.name}${tags} {`, kind: 'head', type: t.id, field: null },
    ...shown.map((f) => fieldLine(p, t, f)),
    { text: '}', kind: 'close', type: t.id, field: null },
  ];
}

/**
 * The SDL of graph types as structured lines (what `printSDL` joins): the composed schema, or with `only` the SDL
 * one subgraph would hold (what it owns, plus the `@external` fields it needs: key fields it does not resolve and the
 * fields its `@provides` and `@requires` name). Types print in the order given; one with nothing to print is skipped.
 */
export function sdlLines(
  g: SystemGraph,
  typeIds: readonly string[],
  options: SdlOptions = {},
): SdlLine[] {
  const only = options.only ?? null;
  const types = typeIds.map((id) => g.get(id)).filter((t) => t?.$type === 'schema');
  const first = types.find((t) => t.graph !== undefined);
  const idx = first === undefined ? null : graphIndex(g, first.graph);
  const external = only !== null && idx !== null ? externalOf(idx, only) : new Set<string>();
  const p: Printing = { g, idx, only };
  const lines: SdlLine[] = [];
  for (const t of types) {
    const block = typeLines(p, t, external);
    if (block.length === 0) continue;
    if (lines.length > 0) lines.push({ text: '', kind: 'blank', type: t.id, field: null });
    lines.push(...block);
  }
  return lines;
}

/** Graph types as SDL text: `type Product @key(fields: "sku") {`, each field with its directives and owner. */
export function printSDL(
  g: SystemGraph,
  typeIds: readonly string[],
  options: SdlOptions = {},
): string {
  return sdlLines(g, typeIds, options)
    .map((l) => l.text)
    .join('\n');
}
