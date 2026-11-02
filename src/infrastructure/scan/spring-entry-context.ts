import 'server-only';

import type { CallBinding, ValueBinding } from './java-call-binding-types';
import { declarationSource } from './java-declaration-parts';
import type { JavaMethod } from './java-declarations';
import type { SourceIndex, SyntaxNode } from './source-index-types';
import type { EntryBoundary, EntryCatalogueInput } from './spring-entry-types';

export interface EntrySyntax {
  readonly index: SourceIndex;
  readonly node: SyntaxNode;
}
export interface EntryPlannerContext {
  readonly input: EntryCatalogueInput;
  readonly syntax: ReadonlyMap<string, EntrySyntax>;
  readonly methods: ReadonlyMap<string, JavaMethod>;
  readonly fields: ReadonlySet<string>;
  readonly calls: ReadonlyMap<string, readonly CallBinding[]>;
  readonly values: ReadonlyMap<string, readonly ValueBinding[]>;
  readonly boundaries: ReadonlyMap<string, readonly string[]>;
}

function indexedCalls(calls: readonly CallBinding[]): ReadonlyMap<string, readonly CallBinding[]> {
  const result = new Map<string, CallBinding[]>();
  for (const call of calls) {
    if (call.caller === null) continue;
    const values = result.get(call.caller) ?? [];
    values.push(call);
    result.set(call.caller, values);
  }
  return result;
}

function indexedValues(
  values: readonly ValueBinding[],
): ReadonlyMap<string, readonly ValueBinding[]> {
  const result = new Map<string, ValueBinding[]>();
  for (const value of values) {
    const group = result.get(value.to) ?? [];
    group.push(value);
    result.set(value.to, group);
  }
  return result;
}

/** Build references once; semantic graphs remain in the retained source cache until a query selects them. */
export function entryPlannerContext(
  input: EntryCatalogueInput,
  boundaries: readonly EntryBoundary[],
): EntryPlannerContext {
  const syntax = new Map<string, EntrySyntax>();
  for (const index of input.indexes) {
    if (index.diagnostics.length > 0) continue;
    for (const node of index.nodes) syntax.set(declarationSource(index, node), { index, node });
  }
  const types = input.units.flatMap((unit) => unit.types);
  const boundaryIds = new Map<string, string[]>();
  for (const boundary of boundaries) {
    const group = boundaryIds.get(boundary.source_id) ?? [];
    group.push(boundary.binding_id);
    boundaryIds.set(boundary.source_id, group);
  }
  return {
    input,
    syntax,
    methods: new Map(
      types.flatMap((type) => type.methods.map((method) => [method.source, method] as const)),
    ),
    fields: new Set(types.flatMap((type) => type.fields.map((field) => field.source))),
    calls: indexedCalls(input.calls),
    values: indexedValues(input.values),
    boundaries: boundaryIds,
  };
}

function declarationNodes(declaration: EntrySyntax): readonly SyntaxNode[] {
  return declaration.index.nodes.filter(
    (node) => node.start >= declaration.node.start && node.end <= declaration.node.end,
  );
}

export function declarationSources(declaration: EntrySyntax): readonly string[] {
  return declarationNodes(declaration).map((node) => declarationSource(declaration.index, node));
}
