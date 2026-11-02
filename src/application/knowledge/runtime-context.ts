import type { KnowledgeReader } from '@/domain/knowledge/knowledge-reader';
import type {
  ExecutionBinding,
  Interaction,
  QueryRequest,
} from '@/domain/knowledge/knowledge.generated';

function subscriptionExecutions(reader: KnowledgeReader, entry: string, owner: string): string[] {
  return reader.select('owner', owner).flatMap((record) => {
    if (record.kind !== 'interaction' || record.mode !== 'consume') {
      return [];
    }
    if (record.handoff === null) return unmatchedExecution(reader, record, entry);
    const handoff = reader.get(record.handoff);
    return handoff?.kind === 'handoff' && handoff.subscription === entry ? [record.execution] : [];
  });
}

function unmatchedExecution(reader: KnowledgeReader, record: Interaction, id: string): string[] {
  const subscription = reader.get(id);
  if (subscription?.kind !== 'subscription') return [];
  const binding = reader.get(subscription.binding);
  if (binding?.kind !== 'channel_binding') return [];
  const target = reader
    .select('resource', binding.resource)
    .some((item) => item.kind === 'resource_binding' && item.component === record.target);
  return target ? [record.execution] : [];
}

function subscriptionExecution(
  reader: KnowledgeReader,
  entry: { readonly id: string; readonly owner: string },
): ExecutionBinding | null {
  const executions = [...new Set(subscriptionExecutions(reader, entry.id, entry.owner))];
  const execution = executions.length === 1 ? reader.get(executions[0] ?? '') : undefined;
  return execution?.kind === 'execution_binding' ? execution : null;
}

export function entryExecution(
  reader: KnowledgeReader,
  request: QueryRequest,
): ExecutionBinding | null {
  const entry = reader.get(request.entry);
  if (entry?.kind === 'implementation') {
    const bindings = reader
      .select('implementation', entry.id)
      .filter((record) => record.kind === 'execution_binding');
    return bindings.length === 1 ? (bindings[0] ?? null) : null;
  }
  if (entry?.kind === 'subscription') {
    return subscriptionExecution(reader, entry);
  }
  const exposures = reader
    .select('entry', request.entry)
    .filter((record) => record.kind === 'entry_binding');
  const ids = exposures.map((exposure) => exposure.execution);
  const records = ids
    .map((id) => reader.get(id))
    .filter((record) => record?.kind === 'execution_binding');
  return records.length === 1 ? (records[0] ?? null) : null;
}

/** A local library call stays in its host; only an explicit handoff changes this invocation's host. */
export function contextComponent(
  reader: KnowledgeReader,
  root: ExecutionBinding,
  context: readonly string[],
): string | null {
  let component: string | null = root.component;
  for (const id of context) {
    const frame = reader.get(id);
    if (frame?.kind !== 'handoff') continue;
    const consumers = reader
      .select('handoff', frame.id)
      .filter(
        (record): record is Interaction =>
          record.kind === 'interaction' && record.mode === 'consume',
      );
    const matches = consumers
      .map((consumer) => reader.get(consumer.execution))
      .filter((record) => record?.kind === 'execution_binding');
    component = matches.length === 1 ? (matches[0]?.component ?? null) : null;
  }
  return component;
}
