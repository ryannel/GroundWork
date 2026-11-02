import type { KnowledgeReader } from '@/domain/knowledge/knowledge-reader';
import type { KnowledgeRecord, QueryResponse, Value } from '@/domain/knowledge/knowledge.generated';

interface Position {
  readonly value: string;
  readonly context: readonly string[];
}
interface Walk {
  readonly reader: KnowledgeReader;
  readonly result: QueryResponse;
}
interface Origin {
  readonly position: Position;
  readonly record: string;
  readonly label: string;
}
interface Binding {
  readonly value: string;
  readonly label: string;
  readonly unresolved: boolean;
}

function invocationBinding(call: KnowledgeRecord | undefined, value: Value): Binding | null {
  if (call?.kind !== 'operation') return null;
  if (value.role === 'receiver') {
    const receiver = call.receiver ?? null;
    return receiver === null
      ? null
      : {
          value: receiver,
          label: 'instance receiver binding; mutation and aliases are not inferred',
          unresolved: false,
        };
  }
  const capture = call.captureBindings?.find((item) => item.capture === value.id);
  return capture === undefined
    ? null
    : {
        value: capture.value,
        label: `lexical capture origin (${capture.mode}); mutation and alias behaviour are not inferred`,
        unresolved: capture.mode === 'unresolved',
      };
}

function unresolved(walk: Walk, position: Position, reference: string): void {
  walk.result.frontiers.push({
    at: `${position.context.length === 0 ? 'root' : position.context.join('>')}::${position.value}`,
    reason: 'binding_unresolved',
    detail: 'Capture or receiver invocation binding is unresolved; no copy or alias guarantee.',
    references: [reference],
  });
}

/** Origins describe lexical bindings, not writes through shared mutable references. */
export function invocationOrigins(walk: Walk, position: Position, value: Value): Origin[] {
  if (value.role !== 'capture' && value.role !== 'receiver') return [];
  const context = [...position.context];
  const id = context.pop();
  const call = id === undefined ? undefined : walk.reader.get(id);
  const binding = invocationBinding(call, value);
  if (binding === null || call === undefined) {
    unresolved(walk, position, value.id);
    return [];
  }
  if (binding.unresolved) unresolved(walk, position, call.id);
  return [
    {
      position: { value: binding.value, context },
      record: call.id,
      label: binding.label,
    },
  ];
}
