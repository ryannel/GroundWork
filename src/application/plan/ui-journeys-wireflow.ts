import { flowExperience, type Moment, type MomentKind } from '@/application/plan/flow-experience';
import type { FlowModel } from '@/application/plan/flow-steps';
import {
  recordedStep,
  type RecordedStep,
  type Route,
  type Stop,
  todayJourneys,
} from '@/application/plan/ui-journeys';
import type { ScreenNode, StepNode } from '@/domain/plan/plan-graph';

/** One screen-linked step, addressable by its exact step. */
export interface WireRecord extends RecordedStep {
  readonly screen: string;
  readonly region: string | null;
  readonly experienceKind: MomentKind;
  /** Whether the kind is grouping evidence for a person's action, not proof of it. */
  readonly classificationInferred: boolean;
  readonly supportingSteps: readonly RecordedStep[];
}

/** Authored prose on the steps between two screens, kept verbatim. */
export interface Note {
  readonly stepId: string;
  readonly type: 'logic' | 'fails';
  readonly text: string;
}

/** The recorded order from one screen to the next. It asserts no click, condition or return path. */
export interface Connector {
  readonly kind: 'output' | 'recorded-order';
  readonly label: string;
  readonly sourceStepId: string;
  readonly destinationStepId: string;
  readonly sourceScreen: string;
  readonly destinationScreen: string;
  readonly steps: readonly RecordedStep[];
  readonly notes: readonly Note[];
}

export interface WireStop extends Stop {
  readonly records: readonly WireRecord[];
  readonly connector: Connector | null;
}

export interface WireRoute extends Omit<Route, 'stops'> {
  readonly stops: readonly WireStop[];
  readonly connectors: readonly Connector[];
}

export interface Wireflows {
  readonly routes: readonly WireRoute[];
  readonly unlinked: readonly ScreenNode[];
  readonly stops: readonly WireStop[];
}

const OUTPUTS = new Set(['email', 'print', 'push']);

const isOutput = (model: FlowModel, screenId: string): boolean => {
  const node = model.asIs.get(screenId);
  return node?.$type === 'screen' && node.kind !== undefined && OUTPUTS.has(node.kind);
};

/** The screen-linked moments of a flow by the step that starts them. */
function momentsOf(model: FlowModel, route: Route): Map<string, Moment> {
  const moments = new Map<string, Moment>();
  for (const moment of flowExperience(model, route.id, 'asIs')) {
    const id = route.flow.steps[moment.anchor]?.id;
    if (moment.screen !== null && id !== undefined) moments.set(id, moment);
  }
  return moments;
}

function recordOf(
  steps: readonly StepNode[],
  stop: Stop,
  of: { readonly step: StepNode; readonly moment: Moment | undefined },
): WireRecord {
  const { step, moment } = of;
  const kind = moment?.kind ?? 'linked';
  return {
    ...recordedStep(step),
    screen: stop.screen,
    region: step.screen?.includes('#') === true ? step.screen : null,
    experienceKind: kind,
    classificationInferred: kind === 'action' || kind === 'update',
    supportingSteps: (moment?.indices ?? []).flatMap((index) => {
      const supporting = steps[index];
      return supporting === undefined ? [] : [recordedStep(supporting)];
    }),
  };
}

const notesOf = (steps: readonly RecordedStep[]): Note[] =>
  steps.flatMap((step) =>
    (['logic', 'fails'] as const).flatMap((type) => {
      const text = step[type];
      return text === null || text === '' ? [] : [{ stepId: step.stepId, type, text }];
    }),
  );

function connectorOf(
  model: FlowModel,
  steps: readonly StepNode[],
  pair: { readonly stop: Stop; readonly next: Stop; readonly source: WireRecord },
): Connector {
  const { stop, next, source } = pair;
  const output = isOutput(model, next.screen);
  const boundary = steps.slice(stop.end, next.start + 1).map(recordedStep);
  return {
    kind: output ? 'output' : 'recorded-order',
    label: output ? 'Recorded output' : 'Next recorded screen',
    sourceStepId: source.stepId,
    destinationStepId: next.actions[0]?.id ?? '',
    sourceScreen: stop.screen,
    destinationScreen: next.screen,
    steps: boundary,
    notes: notesOf(boundary),
  };
}

function wireRoute(model: FlowModel, route: Route): WireRoute {
  const steps = route.flow.steps;
  const moments = momentsOf(model, route);
  const stops = route.stops.map((stop, i): WireStop => {
    const records = stop.actions.map((step) =>
      recordOf(steps, stop, { step, moment: moments.get(step.id) }),
    );
    const next = route.stops[i + 1];
    const source = records.at(-1);
    const connector =
      next === undefined || source === undefined
        ? null
        : connectorOf(model, steps, { stop, next, source });
    return { ...stop, records, connector };
  });
  return {
    ...route,
    stops,
    connectors: stops.flatMap((stop) => (stop.connector === null ? [] : [stop.connector])),
  };
}

/**
 * Baseline wireflow data, with each screen-linked action or update addressable by its exact step. Experience
 * kinds describe evidence grouping, not proof of a person's click. Connectors assert recorded order only;
 * authored prose stays verbatim rather than becoming an inferred control, condition or return path.
 */
export function todayWireflows(model: FlowModel): Wireflows {
  const journeys = todayJourneys(model);
  const routes = journeys.routes.map((route) => wireRoute(model, route));
  return {
    routes,
    unlinked: journeys.unlinked,
    stops: routes.flatMap((route) => route.stops),
  };
}
