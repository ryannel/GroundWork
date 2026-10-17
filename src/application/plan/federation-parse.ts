import { createCursor, tokenize, type Cursor } from '@/application/plan/federation-lex';

// A small GraphQL executable-document parser: operations and fragments, no graphql-js.

export interface Sel {
  readonly name: string;
  readonly alias: string | null;
  /** Alias, else name: the key the response carries. */
  readonly key: string;
  readonly selections: readonly Sel[] | null;
}

export interface Variable {
  readonly name: string;
  readonly type: string;
  /** Non-null with no default: it must be sent. */
  readonly required: boolean;
}

export type OperationKind = 'query' | 'mutation' | 'subscription';

export interface ParsedDocument {
  readonly ok: boolean;
  /** Names the line on a syntax error, an undefined or cyclic fragment, or a document without an operation. */
  readonly error: string | null;
  readonly kind: OperationKind | null;
  readonly name: string | null;
  readonly variables: readonly Variable[];
  /** How many operations the document holds (the first one is returned). */
  readonly operations: number;
  readonly selections: readonly Sel[];
}

type RawSel =
  | {
      readonly type: 'field';
      readonly name: string;
      readonly alias: string | null;
      readonly selections: readonly RawSel[] | null;
    }
  | { readonly type: 'inline'; readonly selections: readonly RawSel[] }
  | { readonly type: 'spread'; readonly name: string };

interface Fragment {
  readonly selections: readonly RawSel[];
}

interface RawOperation {
  readonly kind: OperationKind;
  readonly name: string | null;
  readonly variables: readonly Variable[];
  readonly selections: readonly RawSel[];
}

function skipValue(c: Cursor): void {
  if (c.at('$')) {
    c.next();
    c.name();
  } else if (c.at('[')) c.skipGroup('[', ']');
  else if (c.at('{')) c.skipGroup('{', '}');
  else c.next();
}

function directives(c: Cursor): void {
  while (c.at('@')) {
    c.next();
    c.name();
    if (c.at('(')) c.skipGroup('(', ')');
  }
}

function typeRef(c: Cursor): string {
  let s: string;
  if (c.at('[')) {
    c.next();
    s = `[${typeRef(c)}]`;
    c.eat(']');
  } else s = c.name();
  if (c.at('!')) {
    c.next();
    s += '!';
  }
  return s;
}

function selectionSet(c: Cursor): RawSel[] {
  c.eat('{');
  const out: RawSel[] = [];
  while (!c.at('}')) out.push(selection(c));
  c.next();
  return out;
}

function fragmentSpread(c: Cursor): RawSel {
  if (c.atName('on')) {
    c.next();
    c.name();
    directives(c);
    return { type: 'inline', selections: selectionSet(c) };
  }
  if (c.atName()) {
    const name = c.name();
    directives(c);
    return { type: 'spread', name };
  }
  directives(c);
  return { type: 'inline', selections: selectionSet(c) };
}

function selection(c: Cursor): RawSel {
  if (c.at('...')) {
    c.next();
    return fragmentSpread(c);
  }
  let name = c.name();
  let alias: string | null = null;
  if (c.at(':')) {
    c.next();
    alias = name;
    name = c.name();
  }
  if (c.at('(')) c.skipGroup('(', ')');
  directives(c);
  return { type: 'field', name, alias, selections: c.at('{') ? selectionSet(c) : null };
}

function variable(c: Cursor): Variable {
  c.eat('$');
  const name = c.name();
  c.eat(':');
  const type = typeRef(c);
  let hasDefault = false;
  if (c.at('=')) {
    c.next();
    skipValue(c);
    hasDefault = true;
  }
  directives(c);
  return { name, type, required: type.endsWith('!') && !hasDefault };
}

function operation(c: Cursor, kind: OperationKind): RawOperation {
  const name = c.atName() ? c.next().v : null;
  const variables: Variable[] = [];
  if (c.at('(')) {
    c.next();
    while (!c.at(')')) variables.push(variable(c));
    c.next();
  }
  directives(c);
  return { kind, name, variables, selections: selectionSet(c) };
}

function isKind(word: string): word is OperationKind {
  return word === 'query' || word === 'mutation' || word === 'subscription';
}

function fragmentDefinition(c: Cursor): [string, Fragment] {
  const name = c.name();
  if (!c.atName('on')) c.fail('"on"');
  c.next();
  c.name();
  directives(c);
  return [name, { selections: selectionSet(c) }];
}

function document(c: Cursor): {
  readonly ops: readonly RawOperation[];
  readonly fragments: ReadonlyMap<string, Fragment>;
} {
  const ops: RawOperation[] = [];
  const fragments = new Map<string, Fragment>();
  while (c.peek() !== undefined) {
    if (c.at('{')) {
      ops.push({ kind: 'query', name: null, variables: [], selections: selectionSet(c) });
      continue;
    }
    const kw = c.name();
    if (kw === 'fragment') {
      const [name, fragment] = fragmentDefinition(c);
      fragments.set(name, fragment);
    } else if (isKind(kw)) ops.push(operation(c, kw));
    else {
      c.back();
      c.fail('query, mutation, subscription or fragment');
    }
  }
  return { ops, fragments };
}

interface Merged {
  readonly name: string;
  readonly alias: string | null;
  readonly key: string;
  readonly selections: readonly RawSel[] | null;
}

interface Flattened {
  readonly selections: readonly Sel[];
  readonly errors: readonly string[];
}

/** The fields of a selection list, fragments spread and same-key fields merged, with what went wrong. */
function mergeFields(
  selections: readonly RawSel[],
  fragments: ReadonlyMap<string, Fragment>,
): { readonly merged: readonly Merged[]; readonly errors: readonly string[] } {
  const byKey = new Map<string, Merged>();
  const errors: string[] = [];
  const addField = (s: Extract<RawSel, { readonly type: 'field' }>): void => {
    const key = s.alias ?? s.name;
    const cur = byKey.get(key);
    if (cur === undefined) {
      byKey.set(key, { name: s.name, alias: s.alias, key, selections: s.selections });
    } else if (s.selections !== null) {
      byKey.set(key, { ...cur, selections: [...(cur.selections ?? []), ...s.selections] });
    }
  };
  /** The selections a spread brings in, or none (noting why) when it is missing or spreads itself. */
  const spread = (name: string, stack: ReadonlySet<string>): readonly RawSel[] => {
    const fragment = fragments.get(name);
    if (fragment === undefined) errors.push(`fragment ${name} is spread but never defined`);
    else if (stack.has(name)) errors.push(`fragment ${name} spreads itself`);
    return fragment === undefined || stack.has(name) ? [] : fragment.selections;
  };
  const visit = (list: readonly RawSel[], stack: ReadonlySet<string>): void => {
    for (const s of list) {
      if (s.type === 'inline') visit(s.selections, stack);
      else if (s.type === 'field') addField(s);
      else visit(spread(s.name, stack), new Set([...stack, s.name]));
    }
  };
  visit(selections, new Set());
  return { merged: [...byKey.values()], errors };
}

/** Flatten fragments into fields and merge fields with the same response key. */
function flatten(
  selections: readonly RawSel[],
  fragments: ReadonlyMap<string, Fragment>,
): Flattened {
  const { merged, errors } = mergeFields(selections, fragments);
  const children = merged.map((n) =>
    n.selections === null ? null : flatten(n.selections, fragments),
  );
  return {
    selections: merged.map((n, i) => ({ ...n, selections: children[i]?.selections ?? null })),
    errors: [...errors, ...children.flatMap((c) => c?.errors ?? [])],
  };
}

const EMPTY: ParsedDocument = {
  ok: false,
  error: null,
  kind: null,
  name: null,
  variables: [],
  operations: 0,
  selections: [],
};

/**
 * Parse a GraphQL document: operation header, fields and aliases; arguments and directives are skipped; inline
 * and named fragments are expanded and same-key fields merged. Never throws.
 */
export function parseDocument(text: unknown): ParsedDocument {
  if (typeof text !== 'string' || text.trim() === '') {
    return { ...EMPTY, error: 'the document is empty' };
  }
  try {
    const { ops, fragments } = document(createCursor(tokenize(text)));
    const [op] = ops;
    if (op === undefined) {
      return { ...EMPTY, error: 'the document has no query, mutation or subscription' };
    }
    const { selections, errors } = flatten(op.selections, fragments);
    return {
      ok: errors.length === 0,
      error: errors[0] ?? null,
      kind: op.kind,
      name: op.name,
      variables: op.variables,
      operations: ops.length,
      selections,
    };
  } catch (error) {
    return { ...EMPTY, error: error instanceof Error ? error.message : String(error) };
  }
}

export interface TypeRef {
  readonly name: string;
  readonly list: boolean;
  readonly nonNull: boolean;
  readonly itemNonNull: boolean;
}

/** A GraphQL type string in parts: `[Product!]!` → { name: 'Product', list, nonNull, itemNonNull }. */
export function parseTypeRef(text: unknown): TypeRef {
  const s = (typeof text === 'string' ? text : '').replaceAll(/\s+/gu, '');
  const nonNull = s.endsWith('!');
  const inner = nonNull ? s.slice(0, -1) : s;
  const list = inner.startsWith('[');
  const close = inner.lastIndexOf(']');
  const end = close === -1 ? inner.length : close;
  const item = list ? inner.slice(1, end) : inner;
  return {
    name: item.replaceAll(/[[\]!]/gu, ''),
    list,
    nonNull,
    itemNonNull: list && item.endsWith('!'),
  };
}
