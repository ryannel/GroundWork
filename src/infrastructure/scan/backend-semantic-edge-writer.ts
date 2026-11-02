import 'server-only';

import type { Gap, SemanticEdge, SemanticNode } from '@/domain/scan/scan.generated';
import { semanticRoleErrors } from '@/domain/scan/semantic-relations';

import { createSemanticEdgeWriter } from './semantic-edge-identity';

type EdgeArguments = readonly [
  SemanticNode,
  SemanticNode,
  SemanticEdge['relation'],
  number?,
  string?,
];
interface BackendEdgeWriter {
  readonly append: (...args: EdgeArguments) => void;
  readonly gaps: readonly Gap[];
}

/** Unsupported native field roles remain syntax with an explicit gap, never invented value facts. */
export function createBackendEdgeWriter(input: {
  readonly append: (edge: SemanticEdge) => void;
  readonly duplicate: () => void;
}): BackendEdgeWriter {
  const gaps: Gap[] = [];
  const seen = new Set<string>();
  const write = createSemanticEdgeWriter(input.append, { onExactDuplicate: input.duplicate });
  return {
    gaps,
    append(...args) {
      const [from, to, relation, position, label] = args;
      if (!allowedEdge(from, to, relation)) return;
      const fields = {
        kind: 'semantic_edge' as const,
        owner: from.owner,
        source: from.source,
        from: from.id,
        to: to.id,
        relation,
        ...(position === undefined ? {} : { position }),
        ...(label === undefined ? {} : { label }),
      };
      const errors = semanticRoleErrors({ ...fields, id: 'pending' }, { from, to });
      if (errors.length === 0) {
        write(fields);
        return;
      }
      const id = `gap:native-edge:${from.id}:${relation}:${to.id}`;
      if (!seen.has(id)) {
        seen.add(id);
        gaps.push({
          kind: 'gap',
          id,
          source: from.source,
          reason: 'unsupported',
          description: `Native source field ${relation} between ${from.nodeKind} and ${to.nodeKind} is not a supported semantic relation. Only original AST structure is retained; value, control or pattern binding remains unresolved.`,
        });
      }
    },
  };
}

function allowedEdge(
  from: SemanticNode,
  to: SemanticNode,
  relation: SemanticEdge['relation'],
): boolean {
  return (
    from.owner === to.owner ||
    ['callback', 'call_target', 'continuation', 'contains', 'captures'].includes(relation)
  );
}
