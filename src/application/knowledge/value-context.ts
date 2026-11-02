import { handoffMatch } from '@/domain/knowledge/handoff-match';
import type { KnowledgeReader } from '@/domain/knowledge/knowledge-reader';
import type { QueryRequest } from '@/domain/knowledge/knowledge.generated';

function contextTarget(
  reader: KnowledgeReader,
  frame: { readonly id: string; readonly owner: string },
  environment: string,
): string {
  const call = reader.get(frame.id);
  if (call?.kind === 'handoff' && call.owner === frame.owner) {
    return handoffTarget(reader, call.id, environment);
  }
  if (call?.kind !== 'operation' || call.owner !== frame.owner || call.resolution === null) {
    throw new Error(`Invalid or unresolved invocation context: ${frame.id}`);
  }
  const resolution = reader.get(call.resolution);
  if (resolution?.kind !== 'resolution' || resolution.target === null) {
    throw new Error(`Invalid or unresolved invocation context: ${frame.id}`);
  }
  return resolution.target;
}

export function checkValueContext(reader: KnowledgeReader, request: QueryRequest): void {
  const entry = reader.get(request.entry);
  const root = entry?.kind === 'entry' ? entry.implementation : request.entry;
  let owner = entry?.kind === 'subscription' ? entry.owner : root;
  for (const id of request.context) {
    owner = contextTarget(reader, { id, owner }, request.environment ?? '');
  }
  const value = request.value === null ? undefined : reader.get(request.value);
  if (value?.kind !== 'value' || value.owner !== owner) {
    throw new Error('Value must belong to the selected invocation context');
  }
}

function handoffTarget(reader: KnowledgeReader, id: string, environment: string): string {
  const handoff = reader.get(id);
  if (handoff?.kind !== 'handoff') throw new Error('Expected handoff');
  const mismatch = handoffMatch((value) => reader.get(value), handoff, environment);
  const subscription = reader.get(handoff.subscription);
  if (
    handoff.status !== 'source_matched' ||
    mismatch !== null ||
    subscription?.kind !== 'subscription'
  ) {
    throw new Error(`Invalid handoff context: ${mismatch ?? id}`);
  }
  return subscription.owner;
}
