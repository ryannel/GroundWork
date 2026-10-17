import type { Model } from '@/application/plan/derive';
import { type FlowMode, type FlowStep, flowSteps, isTopic } from '@/application/plan/flow-steps';
import { prop } from '@/application/plan/ids';

// The stops of a flow: the places a viewer pauses at as the reader walks it, and the changes ahead that mark its steps.

export interface Stop {
  readonly title: string;
  /** The title in a few words, for a tight space. */
  readonly short: string;
  readonly stepIds: readonly string[];
  readonly indices: readonly number[];
  /** What the steps of a grouped stop have in common, when the plan says. */
  readonly beat: string | null;
  /** The topic the steps of a stop that fans out read from. */
  readonly fan: string | null;
  /** The system the stop is about. */
  readonly actor: string | null;
}

export interface StopOptions {
  /** As-is steps, or to-be (the default; a diff reads as to-be). */
  readonly mode?: FlowMode;
  /** One stop for each step, however the steps group. */
  readonly singleSteps?: boolean;
}

const isService = (model: Model, id: string): boolean =>
  model.get(id) !== undefined && prop(model.get(id), '$type') !== 'store' && !id.startsWith('st:');

/** A step that stays inside one service, or touches only its own store. */
function isInternal(model: Model, s: FlowStep): boolean {
  if (s.from === s.to || s.via === '' || s.via === 'internal') return true;
  return !isService(model, s.to) && !isTopic(model, s.to);
}

interface Open {
  readonly beat: string | null;
  readonly fan: string | null;
  readonly actor: string | null;
  readonly stepIds: readonly string[];
  readonly indices: readonly number[];
}

const fanOf = (model: Model, s: FlowStep): string | null =>
  isTopic(model, s.from) ? s.from : null;

/** Whether a step joins the stop before it. A beat, a fan-out or a shared actor joins; nothing else does. */
function joins(model: Model, last: Open, s: FlowStep): boolean {
  const beat = s.beat ?? null;
  const fan = fanOf(model, s);
  if (beat !== null || last.beat !== null) return beat !== null && last.beat === beat;
  if (fan !== null) return last.fan === fan;
  if (last.fan !== null) return false;
  if (isInternal(model, s)) return s.from === last.actor || !isService(model, s.from);
  return isTopic(model, s.to) ? s.from === last.actor : s.to === last.actor;
}

function actorOf(model: Model, s: FlowStep, fan: string | null): string | null {
  if (fan !== null) return null;
  return isInternal(model, s) || isTopic(model, s.to) ? s.from : s.to;
}

const actionOf = (s: FlowStep): string => (s.action === '' ? s.id : s.action);

function stopOf(open: Open, steps: readonly FlowStep[]): Stop {
  const list = open.indices.flatMap((i) => (steps[i] === undefined ? [] : [steps[i]]));
  const [first] = list;
  if (list.length === 1 && first !== undefined) {
    const title = actionOf(first);
    return { ...open, beat: null, title, short: title };
  }
  const same = list.every((s) => s.beat !== undefined && s.beat === first?.beat);
  const beat = same ? (first?.beat ?? null) : null;
  const joined = list.map(actionOf).join(' → ');
  const fanTitle = `Read by ${String(list.length)} consumers`;
  const title = beat ?? (open.fan === null ? joined : fanTitle);
  const rest = `${first === undefined ? '' : actionOf(first)} +${String(list.length - 1)}`;
  return { ...open, beat, title, short: beat ?? (open.fan === null ? rest : title) };
}

/**
 * Screen interactions stand alone. Authored beats and related internal or fan-out work group, but unrelated
 * actions never merge just to cut the number of stops.
 */
export function stepStops(model: Model, flowId: string, opts: StopOptions = {}): Stop[] {
  const steps = flowSteps(model, flowId, opts.mode === 'asIs' ? 'asIs' : 'toBe');
  const experience = steps.some((s) => s.screen !== undefined);
  const out: Open[] = [];
  for (const [i, s] of steps.entries()) {
    const last = out.at(-1);
    const fan = fanOf(model, s);
    const together = opts.singleSteps !== true && !experience;
    if (last !== undefined && together && joins(model, last, s)) {
      out[out.length - 1] = {
        ...last,
        stepIds: [...last.stepIds, s.id],
        indices: [...last.indices, i],
      };
    } else {
      out.push({
        beat: s.beat ?? null,
        fan,
        actor: actorOf(model, s, fan),
        stepIds: [s.id],
        indices: [i],
      });
    }
  }
  return out.map((o) => stopOf(o, steps));
}

/** The mode a flow opens in: today when it exists today, else the plan's. */
export const defaultMode = (model: Model, flowId: string): 'asIs' | 'toBe' =>
  model.asIs.has(flowId) ? 'asIs' : 'toBe';

/** The stop that holds a step, or the first stop when none does. */
export function stopOfStep(stops: readonly Stop[], step: number): number {
  const at = stops.findIndex((s) => s.indices.includes(step));
  return Math.max(at, 0);
}
