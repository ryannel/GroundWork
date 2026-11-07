import path from 'node:path';

import { buildId, childId, hasPrefix, localId, rootId } from '@/domain/ids';
import { modelList, modelRecord, modelText } from '@/domain/workspace-model';

import { convertCitations, migrationCitations, type MigrationCitations } from './citations';
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
function declaredFlowSteps(files: readonly MigrationFile[]): ReadonlySet<string> {
  return new Set(
    files
      .filter((file) => file.path.startsWith('flows/'))
      .flatMap((file) => {
        const flow = modelRecord(file.value);
        const id = modelText(flow?.id);
        if (id === null) return [];
        return modelList(flow?.steps).flatMap((value) => {
          const step = modelText(modelRecord(value)?.id);
          if (step === null) return [];
          return [rootId(step) === id ? step : childId(id, step)];
        });
      }),
  );
}
interface JourneySupport {
  readonly interaction: string;
  readonly steps: readonly string[];
}
function supportingSteps(interactions: readonly Node[]): readonly JourneySupport[] {
  return interactions.flatMap((interaction) => {
    const id = modelText(interaction.id);
    const steps = modelList(interaction.supporting_steps).flatMap((step) => modelText(step) ?? []);
    return id === null || steps.length === 0 ? [] : [{ interaction: id, steps }];
  });
}
interface JourneyContext {
  readonly actors: readonly Node[];
  readonly flowSteps: ReadonlySet<string>;
  readonly citations: MigrationCitations;
  readonly review: MigrationReview;
}
function journeyContext(
  files: readonly MigrationFile[],
  citations: MigrationCitations,
  review: MigrationReview,
): JourneyContext {
  const workspace = modelRecord(files.find((file) => file.path === 'workspace.yaml')?.value);
  return {
    actors: nodes(workspace?.actors),
    flowSteps: declaredFlowSteps(files),
    citations,
    review,
  };
}
function actorOf(
  value: unknown,
  journey: string,
  file: MigrationFile,
  context: JourneyContext,
): string | undefined {
  if (value === undefined) return undefined;
  const actor = context.actors.find((candidate) => candidate.id === value);
  if (hasPrefix(actor?.id, 'actor')) return actor.id;
  const named = context.actors.filter((candidate) => candidate.name === value);
  const id = named[0]?.id;
  if (named.length === 1 && hasPrefix(id, 'actor')) return id;
  context.review.add('placements', `journey/${journey}/actor`, file.text, {
    sourcePath: file.path,
    actor: value,
    reason: 'No unique declared actor matches the recorded journey actor.',
  });
  return undefined;
}
function journeyFile(file: MigrationFile, context: JourneyContext): CatalogueFile {
  const { flowSteps, citations, review } = context;
  const data = object(file.value);
  const wrapper = modelRecord(data.journey);
  const metadata = wrapper ?? data;
  const authored = object(
    convertCitations(
      Object.fromEntries(
        Object.entries(metadata).filter(([key]) =>
          ['id', 'name', 'actor', 'summary', 'sources', 'cites'].includes(key),
        ),
      ),
      citations,
    ),
  );
  const slug = path.posix.basename(file.path, '.yaml');
  const label = slug.replaceAll('-', ' ');
  const id = buildId('jny', localId(modelText(authored.id) ?? slug));
  const definitions = nodes(data.interactions);
  const interactions =
    wrapper?.interactions === undefined
      ? definitions.map((node) => node.id)
      : modelList(wrapper.interactions);
  const support = supportingSteps(definitions);
  const byInteraction = new Map(support.map((row) => [row.interaction, row.steps]));
  const linked = interactions.flatMap(
    (interaction) => byInteraction.get(String(interaction)) ?? [],
  );
  const flows = [
    ...new Set([
      ...modelList(metadata.flows),
      ...linked.filter((step) => flowSteps.has(step)).map(rootId),
    ]),
  ];
  const actor = actorOf(authored.actor, id, file, context);
  if (wrapper !== null || support.length > 0) {
    review.add('source-notes', `journey/${id}/source`, file.text, {
      sourcePath: file.path,
      sourceText: file.text,
      declaredActor: authored.actor ?? null,
      supportingSteps: support,
      unresolved: linked.filter((step) => !flowSteps.has(step)),
      reason:
        'Journey flow links retain only declared supporting steps that resolve in the source. The exact original step references stay in this receipt.',
    });
  }
  return {
    path: file.path,
    definition: 'JourneyFile',
    value: {
      id,
      name: authored.name ?? label.charAt(0).toUpperCase() + label.slice(1),
      interactions,
      ...Object.fromEntries(
        Object.entries(authored).filter(([key]) => ['summary', 'cites'].includes(key)),
      ),
      ...(actor === undefined ? {} : { actor }),
      ...(flows.length === 0 ? {} : { flows }),
    },
  };
}
export function migrateCatalogues(
  files: readonly MigrationFile[],
  scopes: readonly CatalogueScope[],
  contracts: ReadonlyMap<string, Node>,
  review: MigrationReview,
  citations: MigrationCitations = migrationCitations([], review, 'workspace'),
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
  const context = journeyContext(files, citations, review);
  return [...graphs, ...journeys.map((file) => journeyFile(file, context)), ...updated];
}
