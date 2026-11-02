import 'server-only';

import type { CallBinding, ValueBinding } from './java-call-binding-types';
import { javaAncestors } from './java-call-syntax';
import { declarationSources, type EntryPlannerContext } from './spring-entry-context';
import type { EntryWalkState } from './spring-entry-state';
import type { EntryQueryLimits } from './spring-entry-types';

function frontier(state: EntryWalkState, call: CallBinding, reason: string): void {
  state.addFrontier({
    kind: 'unresolved_call',
    source_id: call.call,
    binding_id: call.id,
    reason,
  });
}

function deferred(context: EntryPlannerContext, call: CallBinding): boolean {
  const syntax = context.syntax.get(call.call);
  return (
    syntax !== undefined &&
    javaAncestors(syntax.index, syntax.node).find((node) =>
      ['METHOD', 'LAMBDA_EXPRESSION'].includes(node.kind),
    )?.kind === 'LAMBDA_EXPRESSION'
  );
}

function followCall(
  context: EntryPlannerContext,
  state: EntryWalkState,
  item: { readonly call: CallBinding; readonly depth: number },
): void {
  const { call, depth } = item;
  state.addCall(call.id);
  if (deferred(context, call)) {
    state.addFrontier({
      kind: 'deferred_execution',
      source_id: call.call,
      binding_id: call.id,
      reason:
        'The call is inside a source callback; its scheduling and invocation remain unverified.',
    });
  }
  if (call.resolution !== 'exact' || call.target === null) {
    frontier(state, call, call.reason);
  } else if (context.methods.has(call.target)) {
    state.enqueue(call.target, depth + 1);
  } else {
    frontier(state, call, 'The exact call target is not a selected indexed method declaration.');
  }
}

function selectField(
  context: EntryPlannerContext,
  state: EntryWalkState,
  input: { readonly value: ValueBinding; readonly limits: EntryQueryLimits },
): readonly string[] {
  const { value, limits } = input;
  if (!context.fields.has(value.from) || state.fields.has(value.from)) return [];
  const field = context.syntax.get(value.from);
  const sources = field === undefined ? [] : declarationSources(field);
  if (
    state.fields.size >= limits.maxFields ||
    field === undefined ||
    state.nodeCount() + sources.length > limits.maxSyntaxNodes
  ) {
    state.addFrontier({
      kind: 'budget',
      source_id: value.from,
      binding_id: value.id,
      reason:
        'The field declaration is unavailable or the selected field or syntax-node budget is exhausted.',
    });
    return [];
  }
  state.selectField(value.from, sources);
  return sources;
}

function fieldsForSources(
  context: EntryPlannerContext,
  state: EntryWalkState,
  input: { readonly sources: readonly string[]; readonly limits: EntryQueryLimits },
): void {
  const pending = [...input.sources];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const source = pending.shift();
    if (source === undefined || visited.has(source)) continue;
    visited.add(source);
    for (const value of context.values.get(source) ?? []) {
      pending.push(...selectField(context, state, { value, limits: input.limits }));
    }
  }
}

export function walkEntryOwner(
  context: EntryPlannerContext,
  state: EntryWalkState,
  input: { readonly source: string; readonly depth: number; readonly limits: EntryQueryLimits },
): void {
  if (state.owners.has(input.source)) return;
  const declaration = context.syntax.get(input.source);
  const sources = declaration === undefined ? [] : declarationSources(declaration);
  const nodes = state.nodeCount();
  if (!declaration || !context.methods.has(input.source)) {
    state.addFrontier({
      kind: 'missing_declaration',
      source_id: input.source,
      binding_id: null,
      reason: 'No non-quarantined indexed method declaration is available.',
    });
    return;
  }
  if (
    input.depth > input.limits.maxDepth ||
    state.owners.size >= input.limits.maxOwners ||
    nodes + sources.length > input.limits.maxSyntaxNodes
  ) {
    state.addFrontier({
      kind: 'budget',
      source_id: input.source,
      binding_id: null,
      reason: 'The method depth, owner or selected syntax-node budget is exhausted.',
    });
    return;
  }
  state.selectOwner(input.source, sources);
  fieldsForSources(context, state, { sources, limits: input.limits });
  for (const call of context.calls.get(input.source) ?? []) {
    if (state.calls.size >= input.limits.maxCalls) {
      state.addFrontier({
        kind: 'budget',
        source_id: call.call,
        binding_id: call.id,
        reason: 'The selected call budget is exhausted.',
      });
    } else followCall(context, state, { call, depth: input.depth });
  }
}
