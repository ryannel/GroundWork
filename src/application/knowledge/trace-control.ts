import type { KnowledgeReader } from '@/domain/knowledge/knowledge-reader';
import type {
  Operation,
  QueryEdge,
  QueryRequest,
  QueryResponse,
  Transition,
} from '@/domain/knowledge/knowledge.generated';

import { boundCallPositions, nonAwaitedPositions } from './control-call';
import { attachCoverage, emptyResult } from './query-result';

const LEGACY_QUERY = 'groundwork-query/v1';

interface Position {
  readonly at: string;
  readonly context: readonly string[];
}
interface NextPosition {
  readonly position: Position;
  readonly edge: QueryEdge;
}
interface EdgeDetail {
  readonly transition: Transition | null;
  readonly on: string;
  readonly assumption: string | null;
}
interface Walk {
  readonly reader: KnowledgeReader;
  readonly result: QueryResponse;
  readonly enqueue: (position: Position) => void;
  readonly markSeen: (id: string) => void;
}

function key(position: Position): string {
  return `${position.context.length === 0 ? 'root' : position.context.join('>')}::${position.at}`;
}

function transitions(reader: KnowledgeReader, at: string): Transition[] {
  return reader.select('from', at).filter((record) => record.kind === 'transition');
}

function next(from: Position, to: Position, detail: EdgeDetail): NextPosition {
  const { transition, on, assumption } = detail;
  return {
    position: to,
    edge: {
      from: key(from),
      to: key(to),
      on,
      condition: transition?.condition ?? null,
      assumption,
      evidence: transition?.evidence ?? [],
      record: transition?.id ?? null,
    },
  };
}

/** Unwind this invocation's stack, preserving typed exception continuations. */
function asynchronousBoundary(reader: KnowledgeReader, id: string): boolean {
  const frame = reader.get(id);
  return frame?.kind === 'handoff' || (frame?.kind === 'operation' && frame.waitsFor === 'none');
}

function resume(reader: KnowledgeReader, position: Position, exit: string): NextPosition[] {
  const context = [...position.context];
  while (context.length > 0) {
    const call = context.pop();
    if (call !== undefined) {
      if (asynchronousBoundary(reader, call)) return [];
      const matches = transitions(reader, call).filter((transition) => transition.on === exit);
      if (matches.length > 0) {
        return matches.map((transition) =>
          next(
            position,
            { at: transition.to, context: [...context] },
            { transition, on: exit, assumption: null },
          ),
        );
      }
    }
  }
  return [];
}

function callPositions(walk: Walk, position: Position, operation: Operation): NextPosition[] {
  if (operation.waitsFor === 'none') {
    walk.result.frontiers.push({
      at: key(position),
      reason: 'concurrency_unresolved',
      detail:
        'Local asynchronous work is not awaited; synchronous prefix, scheduling and interleaving are not established.',
      references: [operation.id],
    });
  }
  const resolution =
    operation.resolution === null ? undefined : walk.reader.get(operation.resolution);
  if (resolution?.kind !== 'resolution') throw new Error(`Missing resolution at ${operation.id}`);
  if (resolution.target === null) {
    walk.result.frontiers.push({
      at: key(position),
      reason: 'version_unresolved',
      detail:
        walk.result.request.format === LEGACY_QUERY
          ? 'Dependency implementation is unresolved; candidates are excluded. Local continuation assumes a normal return.'
          : 'Dependency implementation is unresolved; declared normal and exception continuations are conditional and candidates are excluded.',
      references: [resolution.id],
    });
    return transitions(walk.reader, operation.id)
      .filter(
        (transition) => walk.result.request.format !== LEGACY_QUERY || transition.on === 'normal',
      )
      .map((transition) =>
        next(
          position,
          { at: transition.to, context: position.context },
          {
            transition,
            on: transition.on,
            assumption:
              walk.result.request.format === LEGACY_QUERY
                ? `${operation.id} returns normally despite unresolved effects`
                : `${operation.id}: unresolved dependency follows declared ${transition.on} continuation`,
          },
        ),
      );
  }
  const target = walk.reader.get(resolution.target);
  if (target?.kind !== 'implementation') throw new Error(`Invalid call target at ${operation.id}`);
  const recursive =
    position.context.some((id) => {
      const call = walk.reader.get(id);
      return call?.kind === 'operation' && call.owner === target.id;
    }) || operation.owner === target.id;
  if (recursive) {
    walk.result.frontiers.push({
      at: key(position),
      reason: 'cycle',
      detail: 'Recursive implementation is referenced, not expanded again.',
      references: [target.id],
    });
    return nonAwaitedPositions(walk.reader, position, operation);
  }
  return boundCallPositions(walk.reader, position, { operation, target });
}

function advance(walk: Walk, position: Position, operation: Operation): NextPosition[] {
  if (operation.action === 'call') return callPositions(walk, position, operation);
  if (operation.exit !== null) {
    const positions = resume(walk.reader, position, operation.exit);
    if (
      positions.length === 0 &&
      operation.exit !== 'normal' &&
      walk.result.request.format !== LEGACY_QUERY
    ) {
      walk.result.frontiers.push({
        at: key(position),
        reason: 'unhandled_exception',
        detail:
          'No declared exception continuation within this invocation; asynchronous frames stop unwinding.',
        references: [operation.id],
      });
    }
    return positions;
  }
  if (operation.action === 'opaque') {
    walk.result.frontiers.push({
      at: key(position),
      reason: 'opaque',
      detail: operation.label,
      references: [operation.id],
    });
  }
  return transitions(walk.reader, operation.id).map((transition) =>
    next(
      position,
      { at: transition.to, context: position.context },
      { transition, on: transition.on, assumption: null },
    ),
  );
}

function visit(walk: Walk, position: Position): void {
  if (walk.result.nodes.length >= walk.result.request.maxNodes) {
    walk.result.limitsHit.push('maxNodes');
    walk.result.frontiers.push({
      at: key(position),
      reason: 'query_limit',
      detail: 'Node budget reached; rerun this pinned query with a larger budget.',
      references: [position.at],
    });
    return;
  }
  const operation = walk.reader.get(position.at);
  if (operation?.kind !== 'operation') throw new Error(`Missing operation: ${position.at}`);
  walk.markSeen(key(position));
  walk.result.nodes.push({
    id: key(position),
    record: operation.id,
    context: [...position.context],
    label: operation.label,
  });
  for (const step of advance(walk, position, operation)) {
    walk.result.edges.push(step.edge);
    walk.enqueue(step.position);
  }
}

function rootPosition(reader: KnowledgeReader, entryId: string): Position {
  const entry = reader.get(entryId);
  const owner = entry?.kind === 'entry' ? entry.implementation : entryId;
  const implementation =
    entry?.kind === 'subscription' ? reader.get(entry.owner) : reader.get(owner);
  if (implementation?.kind !== 'implementation') {
    throw new Error(`Not an entry or implementation: ${entryId}`);
  }
  return { at: implementation.entry, context: [] };
}

export function traceControl(
  reader: KnowledgeReader,
  request: QueryRequest,
  context: readonly string[] = [],
): QueryResponse {
  const result = attachCoverage(reader, emptyResult(request));
  const pending: Position[] = [{ ...rootPosition(reader, request.entry), context }];
  const seen = new Set<string>();
  const walk: Walk = {
    reader,
    result,
    enqueue: (position) => {
      pending.push(position);
    },
    markSeen: (id) => {
      seen.add(id);
    },
  };
  while (pending.length > 0 && result.limitsHit.length === 0) {
    const position = pending.shift();
    if (position !== undefined && !seen.has(key(position))) visit(walk, position);
  }
  const visible = new Set(result.nodes.map((node) => node.id));
  result.edges = result.edges.filter((edge) => visible.has(edge.from) && visible.has(edge.to));
  return result;
}

/** A backward structural slice; guards remain explicit and feasibility is not checked. */
export function outcomeSlice(reader: KnowledgeReader, result: QueryResponse): QueryResponse {
  const selected = new Set(
    result.nodes
      .filter((node) => {
        const record = reader.get(node.record);
        return record?.kind === 'operation' && record.httpStatus === result.request.outcome;
      })
      .map((node) => node.id),
  );
  let previous = -1;
  while (selected.size !== previous) {
    previous = selected.size;
    for (const edge of result.edges) if (selected.has(edge.to)) selected.add(edge.from);
  }
  const nodes = result.nodes.filter((node) => selected.has(node.id));
  return {
    ...result,
    nodes,
    edges: result.edges.filter((edge) => selected.has(edge.from) && selected.has(edge.to)),
    frontiers: result.frontiers.filter(
      (frontier) => frontier.reason === 'query_limit' || selected.has(frontier.at),
    ),
    findings: [
      {
        statement:
          'Structural paths to the requested outcome; guards are preserved and feasibility is not checked.',
        support: nodes.map((node) => node.record),
        assumptions: ['Earlier unresolved calls return normally where labelled'],
      },
    ],
  };
}
