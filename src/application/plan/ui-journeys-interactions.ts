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
    for (const edge of chosen) {
      path.push(edge);
      edge.journeyIds.push(authored.id);
      if (nodeIds.length === 0) nodeIds.push(edge.source);
    }
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

function visit(journeys: readonly AuthoredJourney[], byScreen: ReadonlyMap<string, MapNode>): void {
  for (const journey of journeys) {
    for (const id of journey.nodeIds) {
      const node = byScreen.get(id);
      if (node === undefined) continue;
      if (!node.journeyIds.includes(journey.id)) node.journeyIds.push(journey.id);
      if (!node.actors.includes(journey.actor)) node.actors.push(journey.actor);
    }
  }
}

/** Navigation comes from explicit UI records, never from neighbouring flows. */
export function interactionScreenMap(model: FlowModel): ScreenMap {
  const graph = model.asIs;
  const nodes = graph.screens.map(newNode);
  const byScreen = new Map(nodes.map((node) => [node.id, node]));
  const edges = edgesOf(graph, byScreen);
  const journeys = graph.userJourneys.map((authored) => journeyOf(authored, edges));
  const groups: ActorGroup[] = groupByActor(journeys);
  visit(journeys, byScreen);
  // Keep all baseline screen-linked work available, without projecting more arrows.
  for (const flow of graph.flows) {
    for (const step of flow.steps) {
      const node = byScreen.get(screenOf(step.screen ?? ''));
      node?.records.push({ ...recordedStep(step), flowId: flow.id });
    }
  }
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
