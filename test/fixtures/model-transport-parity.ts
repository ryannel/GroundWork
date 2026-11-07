import { isDeepStrictEqual } from 'node:util';

import type { ModelIndex } from '@/application/model-index';

export interface TransportParity {
  readonly authored: number;
  readonly components: number;
  readonly entries: number;
  readonly operations: number;
  readonly edges: number;
  readonly systemEdges: number;
  readonly gaps: number;
  readonly retainedEvidence: number;
  readonly unloadedEvidence: number;
  readonly problems: readonly string[];
}

/** The receipt and fixture tests exercise exactly the same ordinary public queries. */
export function transportParityOf(full: ModelIndex, scoped: ModelIndex): TransportParity {
  const problems: string[] = [];
  const same = (at: string, expected: unknown, actual: unknown): void => {
    if (!isDeepStrictEqual(expected, actual)) problems.push(at);
  };
  const { evidence: fullEvidence, ...fullAuthored } = full.model;
  const { evidence: scopedEvidence, ...scopedAuthored } = scoped.model;
  same('authored fields', fullAuthored, scopedAuthored);
  same(
    'repository metadata',
    fullEvidence.map((repo) => repo.repository),
    scopedEvidence.map((repo) => repo.repository),
  );
  same(
    'discovery metadata',
    fullEvidence.map((repo) => repo.discovery),
    scopedEvidence.map((repo) => repo.discovery),
  );
  const authored = full.entities.filter((node) => node.kind !== 'evidence');
  same(
    'authored identities',
    authored.map((node) => node.id),
    scoped.entities.filter((node) => node.kind !== 'evidence').map((node) => node.id),
  );
  for (const node of authored) {
    const current = scoped.get(node.id);
    if (node.kind !== 'workspace') same(`${node.id}: entity`, node, current);
    same(`${node.id}: label`, full.label(node.id), scoped.label(node.id));
    same(`${node.id}: href`, full.href(node.id), scoped.href(node.id));
    same(`${node.id}: placement`, full.place(node.id), scoped.place(node.id));
    same(`${node.id}: team`, full.owningTeam(node.id), scoped.owningTeam(node.id));
    same(`${node.id}: resource owner`, full.resourceOwner(node.id), scoped.resourceOwner(node.id));
    same(`${node.id}: citations`, full.cites(node.id), scoped.cites(node.id));
    same(`${node.id}: homes`, full.codeHomes(node.id), scoped.codeHomes(node.id));
    same(`${node.id}: freshness`, full.freshness(node.id), scoped.freshness(node.id));
  }
  for (const record of scoped.entities.filter((node) => node.kind === 'evidence')) {
    same(`${record.id}: retained evidence`, full.get(record.id), record);
  }
  const components = authored.filter((node) =>
    ['service', 'app', 'store', 'topic'].includes(node.kind),
  );
  for (const component of components) {
    same(`${component.id}: roles`, full.roles(component.id), scoped.roles(component.id));
  }
  const entries = full.entries();
  same('entries', entries, scoped.entries());
  for (const entry of entries) {
    same(`${entry.id}: entry flow`, full.flowOf(entry.id), scoped.flowOf(entry.id));
  }
  const operations = authored.filter((node) => node.kind === 'operation');
  for (const operation of operations) {
    same(
      `${operation.id}: graph reach`,
      full.fieldsReached(operation.id),
      scoped.fieldsReached(operation.id),
    );
  }
  const edges = full.edges();
  const systemEdges = full.edges(undefined, { level: 'system' });
  const gaps = full.gaps();
  same('component edges', edges, scoped.edges());
  same('system edges', systemEdges, scoped.edges(undefined, { level: 'system' }));
  same('gaps', gaps, scoped.gaps());
  return {
    authored: authored.length,
    components: components.length,
    entries: entries.length,
    operations: operations.length,
    edges: edges.length,
    systemEdges: systemEdges.length,
    gaps: gaps.length,
    retainedEvidence: scoped.entities.filter((node) => node.kind === 'evidence').length,
    unloadedEvidence: full.entities.length - scoped.entities.length,
    problems,
  };
}
