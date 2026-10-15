import { actingService } from '@/application/plan/graph-queries';
import { dataOf, type FieldDelta, rootFields, type Sides } from '@/application/plan/impact-fields';
import { baseId, changedKeys, type Planned } from '@/application/plan/impact-planned';
import type { Flow, Step } from '@/domain/plan/plan.generated';

/** What a step or region carries whose shape changes: the schema, and the fields that actually change. */
export interface Carry {
  schema: string;
  fields: FieldDelta[];
}

export type StepMark = 'added' | 'removed' | 'behaviour' | 'data';

export interface JourneyStep {
  id: string;
  step: Step;
  before: Step | null;
  after: Step | null;
  keys: string[];
  carries: Carry[];
  mark: StepMark | null;
  service: string | null;
  team: string | null;
  screen: string | null;
}

export interface Journey {
  id: string;
  flow: Flow;
  status: 'added' | 'removed' | 'changed' | null;
  steps: JourneyStep[];
}

const STEP_KEYS_IGNORED = ['id', '$deprecated'];

/** The step ids of both revisions: a dropped step goes back where it stood, after the step it followed. */
function stepIds(fa: Flow | undefined, fb: Flow | undefined): string[] {
  const list = (fb?.steps ?? []).map((s) => s.id);
  const before = fa?.steps ?? [];
  for (const [i, s] of before.entries()) {
    if (list.includes(s.id)) continue;
    const prev = before.slice(0, i).findLast((x) => list.includes(x.id));
    list.splice(prev === undefined ? 0 : list.indexOf(prev.id) + 1, 0, s.id);
  }
  return list;
}

function markOf(
  a: Step | undefined,
  b: Step | undefined,
  extra: { keys: string[]; carries: Carry[] },
): StepMark | null {
  if (a === undefined) return 'added';
  if (b === undefined) return 'removed';
  if (extra.keys.length > 0) return 'behaviour';
  return extra.carries.length > 0 ? 'data' : null;
}

/** What a live step carries whose shape changes; a step on its way out carries nothing worth checking. */
function carriesOf({ B, shape }: Sides, b: Step | undefined): Carry[] {
  if (b === undefined || B.deprecated.has(b.id)) return [];
  return dataOf(B, b)
    .filter((x) => shape.has(x))
    .map((x) => ({ schema: x, fields: rootFields(shape, x) }));
}

const stepKeys = (a: Step | undefined, b: Step | undefined): string[] =>
  a !== undefined && b !== undefined ? changedKeys(a, b, STEP_KEYS_IGNORED) : [];

const teamOf = (P: Planned, service: string | null): string | null =>
  service === null ? null : (P.services.get(service)?.team ?? null);

function journeyStep(sides: Sides, sid: string): JourneyStep | null {
  const { A, B } = sides;
  const [a, b] = [A.steps.get(sid)?.step, B.steps.get(sid)?.step];
  const s = b ?? a;
  if (s === undefined) return null;
  const P = b === undefined ? A : B;
  const keys = stepKeys(a, b);
  const carries = carriesOf(sides, b);
  const service = actingService(P.g, s);
  return {
    id: sid,
    step: s,
    before: a ?? null,
    after: b ?? null,
    keys,
    carries,
    mark: markOf(a, b, { keys, carries }),
    service,
    team: teamOf(P, service),
    screen: s.screen === undefined ? null : baseId(s.screen),
  };
}

function statusOf(
  fa: Flow | undefined,
  fb: Flow | undefined,
  steps: JourneyStep[],
): Journey['status'] {
  if (fa === undefined) return 'added';
  if (fb === undefined) return 'removed';
  return steps.some((s) => s.mark !== null) ? 'changed' : null;
}

/** Every step of every flow in either revision, marked: added | removed | behaviour | data | null. */
export function journeys(sides: Sides): Journey[] {
  const { A, B } = sides;
  const ids = new Set([...A.flows.keys(), ...B.flows.keys()]);
  return [...ids].flatMap((id) => {
    const [fa, fb] = [A.flows.get(id), B.flows.get(id)];
    const flow = fb ?? fa;
    if (flow === undefined) return [];
    const steps = stepIds(fa, fb).flatMap((sid) => journeyStep(sides, sid) ?? []);
    return [{ id, flow, status: statusOf(fa, fb, steps), steps }];
  });
}
