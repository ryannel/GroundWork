import 'server-only';

import { createHash } from 'node:crypto';

import type { SemanticEdge } from '@/domain/scan/scan.generated';

export type SemanticEdgeFields = Omit<SemanticEdge, 'id'>;
export interface SemanticEdgeDiagnostics {
  readonly exactDuplicateEdges: number;
}
const SEMANTIC_EDGE_IDENTITY_VERSION = 'semantic-edge-identity/v1';

function compareKeys(left: string, right: string): number {
  const leftPoints = Array.from(left, (point) => point.codePointAt(0) ?? -1);
  const rightPoints = Array.from(right, (point) => point.codePointAt(0) ?? -1);
  for (
    let position = 0;
    position < Math.min(leftPoints.length, rightPoints.length);
    position += 1
  ) {
    const difference = (leftPoints[position] ?? -1) - (rightPoints[position] ?? -1);
    if (difference !== 0) return difference;
  }
  return leftPoints.length - rightPoints.length;
}
function canonicalObject(value: object): string {
  const entries: readonly (readonly [string, unknown])[] = Object.entries(value);
  const fieldsByName = new Map(entries);
  const fields = [...fieldsByName.keys()]
    .toSorted(compareKeys)
    .map((key) => `${JSON.stringify(key)}:${canonical(fieldsByName.get(key))}`);
  return `{${fields.join(',')}}`;
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${Array.from(value, (item: unknown) => canonical(item)).join(',')}]`;
  }
  if (typeof value === 'object' && value !== null) return canonicalObject(value);
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new TypeError('Semantic edge identity requires finite JSON numbers.');
  }
  if (value === undefined || ['function', 'symbol', 'bigint'].includes(typeof value)) {
    throw new TypeError('Semantic edge identity requires JSON fields.');
  }
  return JSON.stringify(value);
}
function payload(fields: SemanticEdgeFields): string {
  return canonical(Object.fromEntries(Object.entries(fields).filter(([key]) => key !== 'id')));
}
function identity(body: string): string {
  const digest = createHash('sha256')
    .update(`${SEMANTIC_EDGE_IDENTITY_VERSION}\0${body}`)
    .digest('hex');
  return `semantic-edge:v1:${digest}`;
}

/** All semantic fields participate; existing IDs and traversal order never do. */
export function semanticEdge(fields: SemanticEdgeFields): SemanticEdge {
  return { ...fields, id: identity(payload(fields)) };
}

/** Duplicate facts and hash collisions fail explicitly instead of dropping or numbering facts. */
export function createSemanticEdgeWriter(
  append: (edge: SemanticEdge) => void,
  options?: { readonly onExactDuplicate: (edge: SemanticEdge) => void },
): (fields: SemanticEdgeFields) => void {
  const seen = new Map<string, string>();
  return (fields: SemanticEdgeFields): void => {
    const body = payload(fields);
    const id = identity(body);
    const previous = seen.get(id);
    if (previous === body && options !== undefined) {
      options.onExactDuplicate({ ...fields, id });
      return;
    }
    if (previous !== undefined) {
      const reason =
        previous === body ? 'Duplicate semantic edge fact' : 'Semantic edge hash collision';
      throw new Error(`${reason}: ${id}`);
    }
    seen.set(id, body);
    append({ ...fields, id });
  };
}
