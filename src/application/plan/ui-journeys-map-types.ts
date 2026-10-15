import type { MomentKind } from '@/application/plan/flow-experience';
import type { RecordedStep } from '@/application/plan/ui-journeys';
import type { Note, WireStop } from '@/application/plan/ui-journeys-wireflow';
import type { FlowNode, InteractionNode, ScreenNode } from '@/domain/plan/plan-graph';

/** A step recorded on a screen, with its flow; a recorded-order visit adds where in the flow it fell. */
export interface MapRecord extends RecordedStep {
  flowId: string;
  screen?: string;
  region?: string | null;
  experienceKind?: MomentKind;
  classificationInferred?: boolean;
  supportingSteps?: RecordedStep[];
  stopIndex?: number;
  visitIndex?: number;
}

/** One screen, once, whatever journeys visit it. */
export interface MapNode {
  id: string;
  screen: ScreenNode;
  journeyIds: string[];
  actors: (string | null)[];
  records: MapRecord[];
}

interface EdgeBase {
  id: string;
  flowId: string;
  actor: string | null;
  source: string;
  destination: string;
  sourceStepId: string | null;
  destinationStepId: string | null;
  kind: string;
  label: string;
  displayLabel: string;
  labelSource: string;
  labelEvidence: string;
  region: string | null;
  regionName: string | null;
  steps: RecordedStep[];
  notes: Note[];
}

/** Two screens in recorded order. The label is authored; the link is only that the order was recorded. */
export interface RecordedEdge extends EdgeBase {
  relationship: 'recorded-order';
  sourceStepId: string;
  destinationStepId: string;
}

/** A navigation, update or output that an authored interaction states. */
export interface InteractionEdge extends EdgeBase {
  relationship: 'interaction';
  interactionId: string;
  interaction: InteractionNode;
  sourceReference: string;
  destinationReference: string;
  /** Several regions of the source screen start it, so it is drawn once from the screen. */
  shared: boolean;
  condition: string | null;
  result: string | null;
  trigger: InteractionNode['trigger'];
  journeyIds: string[];
}

export type MapEdge = RecordedEdge | InteractionEdge;

/** A journey that follows the recorded order of one flow. */
export interface RecordedJourney {
  explicit: false;
  id: string;
  name: string;
  actor: string | null;
  flow: FlowNode;
  trigger: string | undefined;
  outcome: string | undefined;
  nodeIds: string[];
  edgeIds: string[];
  /** Visits keep same-screen records and the work between them for inspection. */
  stops: WireStop[];
}

/** A journey an author wrote as an ordered list of interactions. */
export interface AuthoredJourney {
  explicit: true;
  id: string;
  name: string;
  actor: string | null;
  interactionIds: string[];
  edgeIds: string[];
  nodeIds: string[];
  pathNodeIds: string[];
  /** The screens the journey can start on; more than one when it starts at a shared control. */
  entranceIds: string[];
  records: RecordedStep[];
  stops: never[];
  flow: null;
}

export type MapJourney = RecordedJourney | AuthoredJourney;

export interface ActorGroup {
  actor: string | null;
  journeyIds: string[];
  nodeIds: string[];
}

export interface ScreenMap {
  /** Whether the edges come from authored interactions rather than recorded order. */
  explicit: boolean;
  nodes: MapNode[];
  edges: MapEdge[];
  journeys: MapJourney[];
  groups: ActorGroup[];
  unlinked: ScreenNode[];
}

export const newNode = (screen: ScreenNode): MapNode => ({
  id: screen.id,
  screen,
  journeyIds: [],
  actors: [],
  records: [],
});

/** Journeys grouped by who does them, with the screens they reach. */
export function groupByActor(
  journeys: readonly { id: string; actor: string | null; nodeIds: readonly string[] }[],
): ActorGroup[] {
  const groups = new Map<string | null, ActorGroup>();
  for (const journey of journeys) {
    const group = groups.get(journey.actor) ?? {
      actor: journey.actor,
      journeyIds: [],
      nodeIds: [],
    };
    groups.set(journey.actor, group);
    group.journeyIds.push(journey.id);
    for (const id of journey.nodeIds) if (!group.nodeIds.includes(id)) group.nodeIds.push(id);
  }
  return [...groups.values()];
}
