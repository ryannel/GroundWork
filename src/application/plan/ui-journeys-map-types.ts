import type { MomentKind } from '@/application/plan/flow-experience';
import type { RecordedStep } from '@/application/plan/ui-journeys';
import type { Note, WireStop } from '@/application/plan/ui-journeys-wireflow';
import type { FlowNode, InteractionNode, ScreenNode } from '@/domain/plan/plan-graph';

/** A step recorded on a screen, with its flow; a recorded-order visit adds where in the flow it fell. */
export interface MapRecord extends RecordedStep {
  readonly flowId: string;
  readonly screen?: string;
  readonly region?: string | null;
  readonly experienceKind?: MomentKind;
  readonly classificationInferred?: boolean;
  readonly supportingSteps?: readonly RecordedStep[];
  readonly stopIndex?: number;
  readonly visitIndex?: number;
}

/** One screen, once, whatever journeys visit it. */
export interface MapNode {
  readonly id: string;
  readonly screen: ScreenNode;
  readonly journeyIds: readonly string[];
  readonly actors: readonly (string | null)[];
  readonly records: readonly MapRecord[];
}

interface EdgeBase {
  readonly id: string;
  readonly flowId: string;
  readonly actor: string | null;
  readonly source: string;
  readonly destination: string;
  readonly sourceStepId: string | null;
  readonly destinationStepId: string | null;
  readonly kind: string;
  readonly label: string;
  readonly displayLabel: string;
  readonly labelSource: string;
  readonly labelEvidence: string;
  readonly region: string | null;
  readonly regionName: string | null;
  readonly steps: readonly RecordedStep[];
  readonly notes: readonly Note[];
}

/** Two screens in recorded order. The label is authored; the link is only that the order was recorded. */
export interface RecordedEdge extends EdgeBase {
  readonly relationship: 'recorded-order';
  readonly sourceStepId: string;
  readonly destinationStepId: string;
}

/** A navigation, update or output that an authored interaction states. */
export interface InteractionEdge extends EdgeBase {
  readonly relationship: 'interaction';
  readonly interactionId: string;
  readonly interaction: InteractionNode;
  readonly sourceReference: string;
  readonly destinationReference: string;
  /** Several regions of the source screen start it, so it is drawn once from the screen. */
  readonly shared: boolean;
  readonly condition: string | null;
  readonly result: string | null;
  readonly trigger: InteractionNode['trigger'];
  readonly journeyIds: readonly string[];
}

export type MapEdge = RecordedEdge | InteractionEdge;

/** A journey that follows the recorded order of one flow. */
export interface RecordedJourney {
  readonly explicit: false;
  readonly id: string;
  readonly name: string;
  readonly actor: string | null;
  readonly flow: FlowNode;
  readonly trigger: string | undefined;
  readonly outcome: string | undefined;
  readonly nodeIds: readonly string[];
  readonly edgeIds: readonly string[];
  /** Visits keep same-screen records and the work between them for inspection. */
  readonly stops: readonly WireStop[];
}

/** A journey an author wrote as an ordered list of interactions. */
export interface AuthoredJourney {
  readonly explicit: true;
  readonly id: string;
  readonly name: string;
  readonly actor: string | null;
  readonly interactionIds: readonly string[];
  readonly edgeIds: readonly string[];
  readonly nodeIds: readonly string[];
  readonly pathNodeIds: readonly string[];
  /** The screens the journey can start on; more than one when it starts at a shared control. */
  readonly entranceIds: readonly string[];
  readonly records: readonly RecordedStep[];
  readonly stops: readonly never[];
  readonly flow: null;
}

export type MapJourney = RecordedJourney | AuthoredJourney;

export interface ActorGroup {
  readonly actor: string | null;
  readonly journeyIds: readonly string[];
  readonly nodeIds: readonly string[];
}

export interface ScreenMap {
  /** Whether the edges come from authored interactions rather than recorded order. */
  readonly explicit: boolean;
  readonly nodes: readonly MapNode[];
  readonly edges: readonly MapEdge[];
  readonly journeys: readonly MapJourney[];
  readonly groups: readonly ActorGroup[];
  readonly unlinked: readonly ScreenNode[];
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
  journeys: readonly {
    readonly id: string;
    readonly actor: string | null;
    readonly nodeIds: readonly string[];
  }[],
): ActorGroup[] {
  const groups = new Map<string | null, ActorGroup>();
  for (const journey of journeys) {
    const group = groups.get(journey.actor) ?? {
      actor: journey.actor,
      journeyIds: [],
      nodeIds: [],
    };
    const fresh = journey.nodeIds.filter(
      (id, i) => !group.nodeIds.includes(id) && journey.nodeIds.indexOf(id) === i,
    );
    groups.set(journey.actor, {
      ...group,
      journeyIds: [...group.journeyIds, journey.id],
      nodeIds: [...group.nodeIds, ...fresh],
    });
  }
  return [...groups.values()];
}
