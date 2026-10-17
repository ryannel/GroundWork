import {
  type FlowMode,
  type FlowModel,
  type FlowStep,
  flowSteps,
} from '@/application/plan/flow-steps';
import { parentOf } from '@/application/plan/ids';
import type { ScreenNode, SystemGraph } from '@/domain/plan/plan-graph';

export type MomentKind = 'background' | 'action' | 'update' | 'output' | 'linked';

export interface Moment {
  readonly kind: MomentKind;
  readonly title: string;
  /** The screen the person is on; null before the first screen. */
  readonly screen: string | null;
  readonly region: string | null;
  /** The step that starts the moment. */
  readonly anchor: number;
  /** Every step that belongs to it, in flow order. */
  readonly indices: readonly number[];
}

const OUTPUTS = new Set(['email', 'print', 'push']);
const INTERACTIVE = new Set(['page', 'modal', 'sheet']);

/** Whether a person acts on the screen, or what the screen shows is updated for them. */
function interactiveKind(graph: SystemGraph, screen: ScreenNode, step: FlowStep): MomentKind {
  const service = graph.get(screen.service);
  const fromUi =
    screen.service === step.from && service?.$type === 'service' && service.kind === 'ui';
  if (fromUi && step.screen?.includes('#') === true) return 'action';
  return screen.service === step.to ? 'update' : 'linked';
}

function kindOf(model: FlowModel, mode: FlowMode, step: FlowStep): MomentKind {
  const graph = mode === 'asIs' || step.$removed === true ? model.asIs : model.toBe;
  const screen = graph.get(parentOf(step.screen) ?? step.screen ?? '');
  if (screen?.$type !== 'screen' || screen.kind === undefined) return 'linked';
  if (OUTPUTS.has(screen.kind)) return 'output';
  return INTERACTIVE.has(screen.kind) ? interactiveKind(graph, screen, step) : 'linked';
}

/**
 * Screen-linked moments in authored flow order. Following screenless steps belong to the same interval for
 * navigation; this does not assert causality or completion. Repeated references to one screen remain distinct
 * actions or updates.
 */
export function flowExperience(
  model: FlowModel,
  flowId: string,
  mode: FlowMode = 'asIs',
): Moment[] {
  const steps = flowSteps(model, flowId, mode);
  if (!steps.some((step) => step.screen !== undefined)) return [];
  const moments: Moment[] = [];
  for (const [anchor, step] of steps.entries()) {
    if (step.screen === undefined) {
      const last = moments.at(-1);
      if (last === undefined) {
        moments.push({
          kind: 'background',
          title: 'Before the first screen',
          screen: null,
          region: null,
          anchor,
          indices: [anchor],
        });
      } else moments[moments.length - 1] = { ...last, indices: [...last.indices, anchor] };
      continue;
    }
    moments.push({
      kind: kindOf(model, mode, step),
      title: step.action,
      screen: parentOf(step.screen) ?? step.screen,
      region: step.screen.includes('#') ? step.screen : null,
      anchor,
      indices: [anchor],
    });
  }
  return moments;
}
