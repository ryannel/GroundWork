import 'server-only';

import type { EntryQueryFrontier } from './spring-entry-types';

interface PendingOwner {
  readonly source: string;
  readonly depth: number;
}
export interface EntryWalkState {
  readonly owners: ReadonlySet<string>;
  readonly fields: ReadonlySet<string>;
  readonly calls: ReadonlySet<string>;
  readonly selectedSources: ReadonlySet<string>;
  readonly frontiers: readonly EntryQueryFrontier[];
  readonly nodeCount: () => number;
  readonly hasPending: () => boolean;
  readonly next: () => PendingOwner | undefined;
  readonly enqueue: (source: string, depth: number) => void;
  readonly addCall: (id: string) => void;
  readonly addFrontier: (frontier: EntryQueryFrontier) => void;
  readonly selectOwner: (source: string, nodes: readonly string[]) => void;
  readonly selectField: (source: string, nodes: readonly string[]) => void;
}

export function entryWalkState(): EntryWalkState {
  const owners = new Set<string>();
  const fields = new Set<string>();
  const calls = new Set<string>();
  const selectedSources = new Set<string>();
  const frontiers: EntryQueryFrontier[] = [];
  const pending: PendingOwner[] = [];
  let selectedNodes = 0;
  const select = (
    source: string,
    nodes: readonly string[],
    destination: 'owner' | 'field',
  ): void => {
    const selected = destination === 'owner' ? owners : fields;
    selected.add(source);
    selectedNodes += nodes.length;
    for (const node of nodes) selectedSources.add(node);
  };
  return {
    owners,
    fields,
    calls,
    selectedSources,
    frontiers,
    nodeCount: () => selectedNodes,
    hasPending: () => pending.length > 0,
    next: () => pending.shift(),
    enqueue: (source, depth) => {
      pending.push({ source, depth });
    },
    addCall: (id) => {
      calls.add(id);
    },
    addFrontier: (frontier) => {
      frontiers.push(frontier);
    },
    selectOwner: (source, nodes) => {
      select(source, nodes, 'owner');
    },
    selectField: (source, nodes) => {
      select(source, nodes, 'field');
    },
  };
}
