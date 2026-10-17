import { uniq } from '@/application/plan/derive-values';
import {
  isKeyField,
  keyIns,
  memoPerGraph,
  schemaNode,
  sgName,
} from '@/application/plan/federation-index';
import { parseTypeRef } from '@/application/plan/federation-parse';
import { queryPlan } from '@/application/plan/federation-plan';
import type { Fetch, QueryPlan } from '@/application/plan/federation-plan-types';
import { selectionTree, type TreeNode } from '@/application/plan/federation-tree';
import type { FieldNode, SchemaNode, SystemGraph } from '@/domain/plan/plan-graph';

interface PathType {
  readonly path: string;
  readonly type: string;
}

/** The last non-null link under a nulled path, and the deeper selected field whose `!` started it. */
export interface Because extends PathType {
  readonly origin: PathType | null;
}

export interface BlastNull {
  readonly path: string;
  readonly because: Because | null;
}

export interface Blast {
  readonly fetch: string;
  readonly subgraph: string;
  readonly service: string | null;
  readonly wholeResponse: boolean;
  readonly nulls: readonly BlastNull[];
  /** "if Inventory fails, `product` is null because `product.stock` is `Stock!`". */
  readonly message: string;
}

const quoted = (path: string): string => `\`${path}\``;

const typeOf = (n: TreeNode): string => n.typeStr ?? '';

/** Where a null at `n` stops: the nearest nullable ancestor (null = the whole response) and the last `!` crossed. */
function climb(n: TreeNode): { readonly at: string | null; readonly because: TreeNode | null } {
  let cur: TreeNode | null = n;
  let because: TreeNode | null = null;
  while (cur?.nonNull === true) {
    because = cur;
    const p: TreeNode | null = cur.parent;
    // a nullable list item absorbs the null: each line becomes null, the list survives
    if (p?.list === true && !parseTypeRef(p.typeStr).itemNonNull) {
      return { at: `${p.path}[]`, because };
    }
    cur = p;
  }
  return { at: cur?.path ?? null, because };
}

function becauseOf(n: TreeNode, link: TreeNode | null): Because | null {
  if (link === null) return null;
  const origin = n.nonNull && n !== link ? { path: n.path, type: typeOf(n) } : null;
  return { path: link.path, type: typeOf(link), origin };
}

function nullsOf(lost: readonly TreeNode[]): {
  readonly whole: Because | null;
  readonly nulls: ReadonlyMap<string, Because | null>;
} {
  const nulls = new Map<string, Because | null>();
  let whole: Because | null = null;
  for (const n of lost) {
    const { at, because } = climb(n);
    const why = becauseOf(n, because);
    if (at === null) whole ??= why;
    else if (!nulls.has(at)) nulls.set(at, why);
  }
  return { whole, nulls };
}

const reason = (b: Because, upTo: string): string =>
  b.origin === null
    ? `\`${b.path}\` is \`${b.type}\``
    : `\`${b.origin.path}\` is \`${b.origin.type}\` and every parent up to \`${upTo}\` is non-null`;

function messageOf(name: string, whole: Because | null, list: readonly BlastNull[]): string {
  const [only] = list;
  if (whole !== null) {
    return `if ${name} fails, the whole response is empty because ${reason(whole, whole.path)}`;
  }
  if (list.length === 1 && only?.because !== null && only !== undefined) {
    return `if ${name} fails, \`${only.path}\` is null because ${reason(only.because, only.because.path)}`;
  }
  if (list.length === 0) return `if ${name} fails, nothing the page asked for is lost`;
  const paths = list.map((x) => quoted(x.path)).join(', ');
  return `if ${name} fails, ${paths} ${list.length > 1 ? 'are' : 'is'} null`;
}

const blasts = memoPerGraph<Blast[]>();

/**
 * Per fetch, the selected paths that become null when that fetch's subgraph fails (its dependent fetches fail
 * too); a null in a non-null field moves up to the nearest nullable ancestor. A nullable list item (`[X]!`)
 * absorbs the null: the path is then `<list>[]` and the list survives.
 */
export function blastRadius(g: SystemGraph, opId: string): Blast[] {
  return blasts(g, opId, () => {
    const plan = queryPlan(g, opId);
    const byPath = new Map(selectionTree(g, opId).all.map((n) => [n.path, n]));
    return plan.fetches.map((f) => failureOf(g, { plan, byPath }, f));
  });
}

function failureOf(
  g: SystemGraph,
  at: { readonly plan: QueryPlan; readonly byPath: ReadonlyMap<string, TreeNode> },
  f: Fetch,
): Blast {
  const { plan, byPath } = at;
  const failing = new Set([f.id]);
  for (const x of plan.fetches) if (x.after.some((a) => failing.has(a))) failing.add(x.id);
  const lost = plan.selected
    .filter((s) => s.addedByRouter === null && failing.has(s.fetch))
    .flatMap((s) => byPath.get(s.path) ?? []);
  const { whole, nulls } = nullsOf(lost);
  const paths = [...nulls.keys()];
  const top = paths.filter((p) => !paths.some((q) => q !== p && p.startsWith(`${q}.`)));
  const list = whole === null ? top.map((p) => ({ path: p, because: nulls.get(p) ?? null })) : [];
  return {
    fetch: f.id,
    subgraph: f.subgraph,
    service: f.service,
    wholeResponse: whole !== null,
    nulls: list,
    message: messageOf(sgName(g, f.subgraph), whole, list),
  };
}

export interface FieldOwners {
  readonly type: string;
  /** Subgraph id → the field ids it resolves; key fields count for every subgraph in their key's `in`. */
  readonly bySubgraph: Record<string, readonly string[]>;
  /** Subgraphs that resolve a field or are listed in a key. */
  readonly contributors: readonly string[];
  /** In a key's `in` but resolving no non-key field. */
  readonly stubs: readonly string[];
  readonly keys: readonly { readonly fields: readonly string[]; readonly in: readonly string[] }[];
  readonly keyFields: readonly string[];
}

const owners = memoPerGraph<FieldOwners>();

interface Owned {
  readonly by: ReadonlyMap<string, readonly string[]>;
  readonly keyFields: readonly string[];
  readonly owning: ReadonlySet<string>;
}

function ownedBy(t: SchemaNode | undefined): Owned {
  const by = new Map<string, readonly string[]>();
  const keyFields: string[] = [];
  const owning = new Set<string>();
  const put = (sg: string, field: string): void => {
    const cur = by.get(sg) ?? [];
    if (!cur.includes(field)) by.set(sg, [...cur, field]);
  };
  const ownField = (node: SchemaNode, f: FieldNode): void => {
    const key = isKeyField(node, f.name);
    if (key) keyFields.push(f.id);
    for (const sg of f.subgraphs ?? []) {
      put(sg, f.id);
      if (!key) owning.add(sg);
    }
    if (key) for (const sg of keyIns(node, f.name)) put(sg, f.id);
  };
  if (t !== undefined) for (const f of t.fields) ownField(t, f);
  return { by, keyFields, owning };
}

/** Who owns which field of a graph type. */
export function fieldOwners(g: SystemGraph, typeId: string): FieldOwners {
  return owners(g, typeId, () => {
    const t = schemaNode(g, typeId);
    const { by, keyFields, owning } = ownedBy(t);
    const fieldSgs = (t?.fields ?? []).flatMap((f) => f.subgraphs ?? []);
    const contributors = uniq([...fieldSgs, ...keyIns(t, null)]);
    return {
      type: typeId,
      bySubgraph: Object.fromEntries(by),
      contributors,
      stubs: contributors.filter((s) => !owning.has(s)),
      keys: (t?.keys ?? []).map((k) => ({ fields: [...k.fields], in: [...k.in] })),
      keyFields,
    };
  });
}
