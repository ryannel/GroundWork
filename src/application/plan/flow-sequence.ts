import { type FlatRow, type FrameRow, withFrames } from '@/application/plan/flow-frames';
import {
  type FlowMode,
  type FlowModel,
  type FlowStep,
  flowIn,
  flowSteps,
  isJob,
  isSync,
  isTopic,
} from '@/application/plan/flow-steps';
import { parentOf, prop } from '@/application/plan/ids';
import type { FlowNode } from '@/domain/plan/plan-graph';

export type SequenceRow =
  | FlatRow
  | FrameRow
  | { readonly kind: 'enter'; readonly to: string; readonly label: string }
  | { readonly kind: 'note'; readonly on: 'first'; readonly text: string };

export interface Sequence {
  readonly rows: readonly SequenceRow[];
  readonly steps: readonly FlowStep[];
  /** Everything that takes part, in the order it first appears. */
  readonly parts: readonly string[];
  /** The person who starts the flow; null when a job, a schedule or the system does. */
  readonly actor: string | null;
  readonly job: boolean;
  readonly automated: boolean;
  readonly flow: FlowNode | undefined;
}

const screenOf = (s: FlowStep | undefined): string | null =>
  s?.screen === undefined ? null : (parentOf(s.screen) ?? s.screen);

function nameOf(model: FlowModel, id: string): string {
  const e = model.get(id);
  const name = prop(e, 'name') ?? prop(e, 'title');
  return (typeof name === 'string' ? name : id).replaceAll(/\s+/gu, ' ').trim();
}

interface Call {
  readonly i: number;
  readonly step: FlowStep;
}

/** The sync calls that are still open, and the replies that close them. */
function createCalls(model: FlowModel, steps: readonly FlowStep[]) {
  const flat: FlatRow[] = [];
  const stack: Call[] = [];
  const reply = (call: Call): void => {
    const via = model.get(call.step.via);
    const response = prop(via, 'response');
    if (typeof response !== 'string' || model.get(response) === undefined) return;
    flat.push({
      kind: 'reply',
      of: call.i,
      from: call.step.to,
      to: call.step.from,
      label: nameOf(model, response),
      ref: response,
    });
  };
  const finishAbove = (depth: number): void => {
    while (stack.length > depth) {
      const call = stack.pop();
      if (call !== undefined) reply(call);
    }
  };
  const lastWhere = (test: (c: Call) => boolean): number => stack.findLastIndex(test);
  return {
    flat,
    emit: (row: FlatRow): void => {
      flat.push(row);
    },
    open: (call: Call): void => {
      stack.push(call);
    },
    drain: (): void => {
      finishAbove(0);
    },
    arrive(from: string, i: number): void {
      if (isTopic(model, from)) this.consume(from, i);
      else this.unwind(from);
    },
    // working inside an open call (its callee): the calls opened after it have finished;
    // back at its caller: that call and the ones above it have finished; anyone else: nothing returns
    unwind(from: string): void {
      const inside = lastWhere((c) => c.step.to === from);
      if (inside !== -1) {
        finishAbove(inside + 1);
        return;
      }
      const caller = stack.findIndex((c) => c.step.from === from);
      if (caller !== -1) finishAbove(caller);
    },
    // an event consumer runs after its publisher has finished: the call the publisher was working inside has answered
    consume(topic: string, i: number): void {
      const pub = steps.slice(0, i).findLast((p) => p.to === topic && p.via.startsWith('msg:'));
      if (pub === undefined) return;
      const inside = lastWhere((c) => c.step.to === pub.from);
      if (inside !== -1) finishAbove(inside);
    },
  };
}

/** The note that the person is now on another screen, when they are. */
function screenNote(i: number, s: FlowStep, seen: string | null): FlatRow | null {
  const screen = screenOf(s);
  return s.screen !== undefined && screen !== null && screen !== seen
    ? { kind: 'note', on: 'person', at: i, screen: s.screen }
    : null;
}

/** Pass 1: the steps, the replies to sync calls and the notes of what the person sees, flat. */
function flatRows(model: FlowModel, steps: readonly FlowStep[], actor: string | null): FlatRow[] {
  const calls = createCalls(model, steps);
  let seen = actor === null ? null : screenOf(steps[0]);
  for (const [i, s] of steps.entries()) {
    const live = s.$removed !== true;
    if (live) calls.arrive(s.from, i);
    calls.emit({ kind: 'step', i, step: s });
    const note = actor === null ? null : screenNote(i, s, seen);
    if (note !== null) {
      calls.emit(note);
      seen = screenOf(s);
    }
    if (live && isSync(s.via) && s.from !== s.to) calls.open({ i, step: s });
  }
  calls.drain();
  return calls.flat;
}

/** "System" is an authored machine actor, not an unnamed human; a human role such as "System administrator" is not. */
function actorOf(model: FlowModel, flow: FlowNode | undefined, job: boolean) {
  const named = (flow?.actor ?? '').trim();
  const type = prop(model.get(named), '$type');
  const machine = type === 'service' || type === 'store' || type === 'system';
  const automated = job || /^system$/iu.test(named) || machine;
  return { actor: named !== '' && !automated ? named : null, automated };
}

/** The rows of a sequence drawing, plus what the drawing needs around them. */
export function sequenceModel(model: FlowModel, flowId: string, mode: FlowMode = 'toBe'): Sequence {
  const steps = flowSteps(model, flowId, mode);
  const flow =
    flowIn(mode === 'asIs' ? model.asIs : model.toBe, flowId) ?? flowIn(model.asIs, flowId);
  const job = flow !== undefined && isJob(model, flow);
  const { actor, automated } = actorOf(model, flow, job);
  const parts = [...new Set(steps.flatMap((s) => [s.from, s.to]).filter((p) => p !== ''))];
  const first = steps[0];
  const rows: SequenceRow[] = [];
  if (actor !== null && first !== undefined) {
    const screen = screenOf(first);
    rows.push({
      kind: 'enter',
      to: first.from,
      label: screen === null ? '' : nameOf(model, screen),
    });
  }
  if (flow?.trigger !== undefined && flow.trigger !== '' && parts.length > 0) {
    rows.push({ kind: 'note', on: 'first', text: flow.trigger });
  }
  rows.push(...withFrames(model, steps, flatRows(model, steps, actor)));
  return { rows, steps, parts, actor, job, automated, flow };
}

export const sequenceRows = (
  model: FlowModel,
  flowId: string,
  mode: FlowMode = 'toBe',
): readonly SequenceRow[] => sequenceModel(model, flowId, mode).rows;
