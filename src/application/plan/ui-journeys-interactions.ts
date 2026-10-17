import type { FlowModel } from '@/application/plan/flow-steps';
import { recordedStep, type RecordedStep } from '@/application/plan/ui-journeys';
import {
  type ActorGroup,
  type AuthoredJourney,
  groupByActor,
  type InteractionEdge,
  type MapNode,
  newNode,
  type ScreenMap,
} from '@/application/plan/ui-journeys-map-types';
import type { SystemGraph, UserJourneyNode } from '@/domain/plan/plan-graph';

const screenOf = (reference: string): string => reference.split('#')[0] ?? reference;

function nameOf(graph: SystemGraph, id: string): string | null {
  const node = graph.get(id);
  return node?.$type === 'region' || node?.$type === 'screen' ? node.name : null;
}

/** One edge per source screen of each interaction; region sources can share an owning screen. */
function edgesOf(graph: SystemGraph, byScreen: ReadonlyMap<string, MapNode>): InteractionEdge[] {
  return graph.interactions.flatMap((interaction) => {
    const destination = screenOf(interaction.to);
    if (!byScreen.has(destination)) return [];
    const sources = [...new Set(interaction.from.map(screenOf))];
    const steps = (interaction.supporting_steps ?? []).flatMap((id) => {
      const node = graph.get(id);
      return node?.$type === 'step' ? [recordedStep(node)] : [];
    });
    return sources
      .filter((source) => byScreen.has(source))
      .map((source): InteractionEdge => {
        const reference = interaction.from.find((ref) => screenOf(ref) === source) ?? source;
        return {
          id: `${interaction.id}@${source}`,
          interactionId: interaction.id,
          interaction,
          source,
          destination,
          sourceReference: reference,
          destinationReference: interaction.to,
          sourceStepId: steps[0]?.stepId ?? null,
          destinationStepId: steps.at(-1)?.stepId ?? null,
          flowId: steps[0]?.stepId.split('#')[0] ?? '',
          actor: null,
          shared: sources.length > 1,
          kind: interaction.effect,
          relationship: 'interaction',
          label: interaction.name,
          displayLabel: interaction.name,
          labelSource: 'authored-interaction',
          labelEvidence: 'authored-interaction',
          region: reference.includes('#') ? reference : null,
          regionName: nameOf(graph, reference),
          condition: interaction.condition ?? null,
          result: interaction.result ?? null,
          trigger: interaction.trigger,
          steps,
          notes: [],
          journeyIds: [],
        };
      });
  });
}

/**
 * Follow the authored order. Each later source is fixed by the screen the path has reached; a journey that
 * starts at a shared control explicitly has several possible entrances.
 */
function walk(authored: UserJourneyNode, edges: readonly InteractionEdge[]) {
  const path: InteractionEdge[] = [];
  const nodeIds: string[] = [];
  const entranceIds: string[] = [];
  for (const id of authored.interactions) {
    const candidates = edges.filter((edge) => edge.interactionId === id);
    const chosen =
      nodeIds.length > 0 ? candidates.filter((edge) => edge.source === nodeIds.at(-1)) : candidates;
    if (nodeIds.length === 0) entranceIds.push(...chosen.map((edge) => edge.source));
    path.push(...chosen);
    if (nodeIds.length === 0 && chosen[0] !== undefined) nodeIds.push(chosen[0].source);
    if (chosen[0] !== undefined) nodeIds.push(chosen[0].destination);
  }
  return { path, nodeIds, entranceIds };
}

function journeyOf(authored: UserJourneyNode, edges: readonly InteractionEdge[]): AuthoredJourney {
  const { path, nodeIds, entranceIds } = walk(authored, edges);
  const records = new Map<string, RecordedStep>();
  for (const edge of path) for (const step of edge.steps) records.set(step.stepId, step);
  return {
    explicit: true,
    id: authored.id,
    name: authored.name,
    actor: authored.actor ?? null,
    interactionIds: [...authored.interactions],
    edgeIds: path.map((edge) => edge.id),
    nodeIds: [...entranceIds.slice(1), ...nodeIds],
    pathNodeIds: nodeIds,
    entranceIds,
    records: [...records.values()],
    stops: [],
    flow: null,
  };
}

const unique = <T>(xs: readonly T[]): T[] => [...new Set(xs)];

/** Each screen with the journeys that reach it, who does them, and the flow work recorded on it. */
function visit(
  nodes: readonly MapNode[],
  journeys: readonly AuthoredJourney[],
  graph: SystemGraph,
): MapNode[] {
  const records = graph.flows.flatMap((flow) =>
    flow.steps.map((step) => ({
      screen: screenOf(step.screen ?? ''),
      record: { ...recordedStep(step), flowId: flow.id },
    })),
  );
  return nodes.map((node) => {
    const reaching = journeys.filter((journey) => journey.nodeIds.includes(node.id));
    return {
      ...node,
      journeyIds: unique([...node.journeyIds, ...reaching.map((journey) => journey.id)]),
      actors: unique([...node.actors, ...reaching.map((journey) => journey.actor)]),
      records: [
        ...node.records,
        ...records.filter((r) => r.screen === node.id).map((r) => r.record),
      ],
    };
  });
}

/** Each edge with the journeys that take it, once for each time they do. */
const withJourneys = (
  edges: readonly InteractionEdge[],
  journeys: readonly AuthoredJourney[],
): InteractionEdge[] =>
  edges.map((edge) => ({
    ...edge,
    journeyIds: [
      ...edge.journeyIds,
      ...journeys.flatMap((journey) =>
        journey.edgeIds.filter((id) => id === edge.id).map(() => journey.id),
      ),
    ],
  }));

/** Navigation comes from explicit UI records, never from neighbouring flows. */
export function interactionScreenMap(model: FlowModel): ScreenMap {
  const graph = model.asIs;
  const blank = graph.screens.map(newNode);
  const byScreen = new Map(blank.map((node) => [node.id, node]));
  const bare = edgesOf(graph, byScreen);
  const journeys = graph.userJourneys.map((authored) => journeyOf(authored, bare));
  const edges = withJourneys(bare, journeys);
  const groups: ActorGroup[] = groupByActor(journeys);
  // Keep all baseline screen-linked work available, without projecting more arrows.
  const nodes = visit(blank, journeys, graph);
  const linked = new Set(edges.flatMap((edge) => [edge.source, edge.destination]));
  return {
    explicit: true,
    nodes,
    edges,
    journeys,
    groups,
    unlinked: nodes.filter((node) => !linked.has(node.id)).map((node) => node.screen),
  };
}
