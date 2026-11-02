import type { KnowledgeReader } from '@/domain/knowledge/knowledge-reader';
import type { Implementation, Operation, QueryEdge } from '@/domain/knowledge/knowledge.generated';

interface ControlPosition {
  readonly at: string;
  readonly context: readonly string[];
}
interface ControlStep {
  readonly position: ControlPosition;
  readonly edge: QueryEdge;
}

function key(position: ControlPosition): string {
  return `${position.context.length === 0 ? 'root' : position.context.join('>')}::${position.at}`;
}

export function nonAwaitedPositions(
  reader: KnowledgeReader,
  position: ControlPosition,
  operation: Operation,
): ControlStep[] {
  if (operation.waitsFor !== 'none') return [];
  return reader.select('from', operation.id).flatMap((transition): ControlStep[] => {
    if (transition.kind !== 'transition' || transition.on !== 'normal') return [];
    const target = { at: transition.to, context: position.context };
    return [
      {
        position: target,
        edge: {
          from: key(position),
          to: key(target),
          on: 'not_awaited',
          condition: transition.condition,
          assumption:
            'Caller continues without awaiting local work; synchronous prefix and interleaving are not established.',
          evidence: transition.evidence,
          record: transition.id,
        },
      },
    ];
  });
}

export function boundCallPositions(
  reader: KnowledgeReader,
  position: ControlPosition,
  call: { readonly operation: Operation; readonly target: Implementation },
): ControlStep[] {
  const detached = call.operation.waitsFor === 'none';
  const target = { at: call.target.entry, context: [...position.context, call.operation.id] };
  return [
    {
      position: target,
      edge: {
        from: key(position),
        to: key(target),
        on: detached ? 'starts_async' : 'call',
        condition: null,
        assumption: detached
          ? 'Possible local asynchronous work; no scheduler or interleaving is inferred.'
          : null,
        evidence: detached ? call.operation.evidence : [],
        record: detached ? call.operation.id : null,
      },
    },
    ...nonAwaitedPositions(reader, position, call.operation),
  ];
}
