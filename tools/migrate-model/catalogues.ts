import path from 'node:path';

import { buildId, localId, rootId } from '@/domain/ids';
import { modelList, modelRecord, modelText } from '@/domain/workspace-model';

import { convertCitations, type MigrationCitations } from './citations';
import type { MigrationFile } from './files';
import { fingerprint, type MigrationReview } from './review';

type Node = Readonly<Record<string, unknown>>;
interface CatalogueScope {
  readonly folder: string;
  readonly contracts: Node;
  readonly citations: MigrationCitations;
}
export interface CatalogueFile {
  readonly path: string;
  readonly definition: 'GraphFile' | 'JourneyFile' | 'ContractsFile';
  readonly value: unknown;
}
function object(value: unknown): Node {
  const node = modelRecord(value);
  if (node === null) throw new Error('Expected an authored catalogue object.');
  return node;
}
function nodes(value: unknown): readonly Node[] {
  return modelList(value).map(object);
}
function graphsOf(scopes: readonly CatalogueScope[]): readonly CatalogueFile[] {
  const subgraphs: readonly Node[] = scopes.flatMap((scope) =>
    nodes(scope.contracts.subgraphs).map((value) => {
      const { service, ...node } = object(convertCitations(value, scope.citations));
      return { ...node, component: node.component ?? service };
    }),
  );
  return scopes.flatMap((scope) =>
    nodes(scope.contracts.graphs).map((value) => {
      const graph = object(convertCitations(value, scope.citations));
      return {
        path: `graphs/${localId(modelText(graph.id) ?? '')}.yaml`,
        definition: 'GraphFile' as const,
        value: { ...graph, subgraphs: subgraphs.filter((subgraph) => subgraph.graph === graph.id) },
      };
    }),
  );
}
function entryField(value: unknown): Node {
  const entry = object(value);
  const signature = modelText(entry.sig);
  const match =
    signature === null ? null : /^(Query|Mutation|Subscription)\.([_A-Za-z]\w*)\b/u.exec(signature);
  if (match?.[1] === undefined || match[2] === undefined) return entry;
  return { ...entry, field: `${match[1]}.${match[2]}`, signature };
}
function graphInterfaces(contracts: Node, graphs: readonly CatalogueFile[]): Node {
  const subgraphs = graphs.flatMap((graph) => nodes(modelRecord(graph.value)?.subgraphs));
  return {
    ...contracts,
    interfaces: nodes(contracts.interfaces).map((contract) => {
      if (contract.kind !== 'graphql' || contract.subgraph !== undefined) return contract;
      const matches = subgraphs.filter((subgraph) => subgraph.component === contract.component);
      if (matches.length !== 1) return contract;
      return {
        ...contract,
        subgraph: matches[0]?.id,
        entries: modelList(contract.entries).map(entryField),
      };
    }),
  };
}
function screenLocations(
  scopes: readonly CatalogueScope[],
): ReadonlyMap<string, { readonly app: string; readonly scope: CatalogueScope }> {
  return new Map(
    scopes.flatMap((scope) =>
      nodes(scope.contracts.screens).flatMap((screen) => {
        const id = modelText(screen.id);
        const app = modelText(screen.app) ?? modelText(screen.service);
        return id === null || app === null ? [] : [[id, { app, scope }] as const];
      }),
    ),
  );
}
function interactionOf(
  value: Node,
  locations: ReturnType<typeof screenLocations>,
  review: MigrationReview,
): { readonly node: Node; readonly folder: string } | null {
  const from = modelList(value.from);
  const screen = modelText(from[0]);
  const location = screen === null ? undefined : locations.get(rootId(screen));
  if (from.length !== 1 || location === undefined || screen === null) {
    review.add('placements', `interaction/${String(value.id)}`, value, {
      id: value.id,
      from: value.from,
      reason: 'No single declared screen and app determine placement.',
    });
    return null;
  }
  const cites = location.scope.citations.convert(value);
  return {
    folder: location.scope.folder,
    node: {
      id: value.id,
      component: location.app,
      on: screen,
      action: value.trigger,
      ...Object.fromEntries(
        Object.entries(value).filter(([key]) => ['name', 'to', 'effect'].includes(key)),
      ),
      ...(value.result === undefined ? {} : { summary: value.result }),
      ...(value.condition === undefined ? {} : { when: value.condition }),
      ...(cites.length === 0 ? {} : { cites }),
    },
  };
}
function journeyFile(file: MigrationFile): CatalogueFile {
  const data = object(file.value);
  const name = path.posix.basename(file.path, '.yaml');
  const label = name.replaceAll('-', ' ');
  return {
    path: file.path,
    definition: 'JourneyFile',
    value: {
      id: buildId('jny', name),
      name: data.name ?? label.charAt(0).toUpperCase() + label.slice(1),
      interactions: nodes(data.interactions).map((node) => node.id),
    },
  };
}
export function migrateCatalogues(
  files: readonly MigrationFile[],
  scopes: readonly CatalogueScope[],
  contracts: ReadonlyMap<string, Node>,
  review: MigrationReview,
): readonly CatalogueFile[] {
  const graphs = graphsOf(scopes);
  const locations = screenLocations(scopes);
  const additions = new Map<string, readonly Node[]>();
  const journeys = files.filter(
    (file) => file.path.startsWith('journeys/') && file.path.endsWith('.yaml'),
  );
  for (const file of journeys) {
    for (const value of nodes(modelRecord(file.value)?.interactions)) {
      const interaction = interactionOf(value, locations, review);
      if (interaction === null) continue;
      const key = `${interaction.folder}/contracts.yaml`;
      additions.set(key, [...(additions.get(key) ?? []), interaction.node]);
    }
  }
  const updated = [...contracts].map(([file, value]): CatalogueFile => ({
    path: file,
    definition: 'ContractsFile',
    value: {
      ...graphInterfaces(value, graphs),
      interactions: [...modelList(value.interactions), ...(additions.get(file) ?? [])],
    },
  }));
  const identities = new Set<string>();
  for (const graph of graphs) {
    const id = modelText(modelRecord(graph.value)?.id) ?? fingerprint(graph.value);
    if (identities.has(id)) throw new Error(`Graph declared more than once: ${id}`);
    identities.add(id);
  }
  return [...graphs, ...journeys.map(journeyFile), ...updated];
}
