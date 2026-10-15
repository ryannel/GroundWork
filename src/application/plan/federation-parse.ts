import { createCursor, tokenize, type Cursor } from '@/application/plan/federation-lex';

// A small GraphQL executable-document parser: operations and fragments, no graphql-js.

export interface Sel {
  name: string;
  alias: string | null;
  /** Alias, else name: the key the response carries. */
  key: string;
  selections: Sel[] | null;
}

export interface Variable {
  name: string;
  type: string;
  /** Non-null with no default: it must be sent. */
  required: boolean;
}

export type OperationKind = 'query' | 'mutation' | 'subscription';

export interface ParsedDocument {
  ok: boolean;
  /** Names the line on a syntax error, an undefined or cyclic fragment, or a document without an operation. */
  error: string | null;
  kind: OperationKind | null;
  name: string | null;
  variables: Variable[];
  /** How many operations the document holds (the first one is returned). */
  operations: number;
  selections: Sel[];
}

type RawSel =
  | { type: 'field'; name: string; alias: string | null; selections: RawSel[] | null }
  | { type: 'inline'; selections: RawSel[] }
  | { type: 'spread'; name: string };

interface Fragment {
  selections: RawSel[];
}

interface RawOperation {
  kind: OperationKind;
  name: string | null;
  variables: Variable[];
  selections: RawSel[];
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

function document(c: Cursor): { ops: RawOperation[]; fragments: Map<string, Fragment> } {
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
  name: string;
  alias: string | null;
  key: string;
  selections: RawSel[] | null;
}

interface FlattenCtx {
  fragments: ReadonlyMap<string, Fragment>;
  errors: string[];
  byKey: Map<string, Merged>;
}

function addField(byKey: Map<string, Merged>, s: Extract<RawSel, { type: 'field' }>): void {
  const key = s.alias ?? s.name;
  const cur = byKey.get(key);
  if (cur === undefined) {
    byKey.set(key, { name: s.name, alias: s.alias, key, selections: s.selections });
  } else if (s.selections !== null) {
    cur.selections = [...(cur.selections ?? []), ...s.selections];
  }
}

function visit(ctx: FlattenCtx, list: readonly RawSel[], stack: ReadonlySet<string>): void {
  for (const s of list) {
    if (s.type === 'inline') visit(ctx, s.selections, stack);
    else if (s.type === 'field') addField(ctx.byKey, s);
    else visitSpread(ctx, s.name, stack);
  }
}

function visitSpread(ctx: FlattenCtx, name: string, stack: ReadonlySet<string>): void {
  const fragment = ctx.fragments.get(name);
  if (fragment === undefined) ctx.errors.push(`fragment ${name} is spread but never defined`);
  else if (stack.has(name)) ctx.errors.push(`fragment ${name} spreads itself`);
  else visit(ctx, fragment.selections, new Set([...stack, name]));
}

/** Flatten fragments into fields and merge fields with the same response key. */
function flatten(
  selections: readonly RawSel[],
  fragments: ReadonlyMap<string, Fragment>,
  errors: string[],
): Sel[] {
  const ctx: FlattenCtx = { fragments, errors, byKey: new Map() };
  visit(ctx, selections, new Set());
  return [...ctx.byKey.values()].map((n) => ({
    ...n,
    selections: n.selections === null ? null : flatten(n.selections, fragments, errors),
  }));
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
    const errors: string[] = [];
    const selections = flatten(op.selections, fragments, errors);
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
  name: string;
  list: boolean;
  nonNull: boolean;
  itemNonNull: boolean;
}

/** A GraphQL type string in parts: `[Product!]!` → { name: 'Product', list, nonNull, itemNonNull }. */
export function parseTypeRef(text: unknown): TypeRef {
  const s = (typeof text === 'string' ? text : '').replaceAll(/\s+/g, '');
  const nonNull = s.endsWith('!');
  const inner = nonNull ? s.slice(0, -1) : s;
  const list = inner.startsWith('[');
  const close = inner.lastIndexOf(']');
  const end = close === -1 ? inner.length : close;
  const item = list ? inner.slice(1, end) : inner;
  return {
    name: item.replaceAll(/[[\]!]/g, ''),
    list,
    nonNull,
    itemNonNull: list && item.endsWith('!'),
  };
}
