import type { Model } from '@/application/plan/derive';
import type { FlowStep } from '@/application/plan/flow-steps';
import { prop, strings } from '@/application/plan/ids';
import { chipInfo } from '@/application/plan-chips';

// What a plan will do to a flow's steps: the ◇ markers on today's steps, and the changes behind a step.

export interface ChangeMarkers {
  /** The steps the plan revisits, each marked ◇. */
  readonly markers: Readonly<Record<string, string>>;
  /** Why each marked step is marked, in words. */
  readonly reasons: Readonly<Record<string, readonly string[]>>;
  /** The entities each marked step carries to the changes tray. */
  readonly pins: Readonly<Record<string, readonly string[]>>;
}

const TOUCHED = new Set(['modified', 'deprecated', 'removed']);
const SIGNS = /^[+~×−-]\s+/u;

const touches = (model: Model, id: string | undefined): boolean => {
  const status = id === undefined ? null : model.status(id);
  return status !== null && TOUCHED.has(status);
};

const recordIds = (step: FlowStep): string[] =>
  [...(step.reads ?? []), ...(step.writes ?? [])].map((r) => r.split('#')[0] ?? r);

/** Steps the plan inserts into the flow, keyed by the step they follow (else the last one today). */
function insertedAfter(model: Model, flowId: string, lastId: string | undefined) {
  const out = new Map<string, string[]>();
  const ops = (model.plan.changes ?? []).flatMap((c) => c.ops);
  for (const op of ops) {
    if (!('add' in op) || op.add !== 'step' || op.into !== flowId) continue;
    const anchor = op.after !== undefined && model.asIs.has(op.after) ? op.after : lastId;
    const action = op.value.action === '' ? op.value.id : op.value.action;
    if (anchor !== undefined) out.set(anchor, [...(out.get(anchor) ?? []), action]);
  }
  return out;
}

function reasonsFor(model: Model, step: FlowStep, inserted: readonly string[]): string[] {
  const why: string[] = [];
  const status = model.status(step.id);
  if (touches(model, step.id)) {
    why.push(...model.diff(step.id).map((d) => d.summary));
    if (why.length === 0) {
      why.push(status === 'removed' ? 'this step is removed' : 'this step changes');
    }
  }
  if (step.via !== '' && step.via !== 'internal' && touches(model, step.via)) {
    why.push(`${chipInfo(model, step.via).label} is ${model.status(step.via) ?? ''}`);
  }
  for (const action of inserted) why.push(`a new step follows: “${action}”`);
  return [...new Set(why.map((w) => w.replace(SIGNS, '')))];
}

/** Which of today's steps the plan revisits, why, and which touched entities each one carries forward. */
export function changeMarkers(model: Model, flowId: string): ChangeMarkers {
  const flow = model.asIs.get(flowId);
  if (flow?.$type !== 'flow') return { markers: {}, reasons: {}, pins: {} };
  const touched = new Set(model.touchedAsIs());
  const after = insertedAfter(model, flowId, flow.steps.at(-1)?.id);
  const markers: Record<string, string> = {};
  const reasons: Record<string, string[]> = {};
  const pins: Record<string, string[]> = {};
  for (const step of flow.steps) {
    const why = reasonsFor(model, step, after.get(step.id) ?? []);
    if (why.length === 0) continue;
    markers[step.id] = '◇';
    reasons[step.id] = why;
    const ids = [flowId, step.via, ...recordIds(step)].filter((x) => x !== '' && touched.has(x));
    pins[step.id] = [...new Set(ids)];
  }
  return { markers, reasons, pins };
}

const isChange = (id: string): boolean => id.startsWith('chg:');
const moved = (model: Model, id: string): boolean =>
  (model.status(id) ?? 'existing') !== 'existing';

/** The changes that explain a step, most specific first: its interface, its records, then the step itself. */
export function stepChanges(model: Model, step: FlowStep): string[] {
  const out: string[] = [];
  const push = (ids: readonly (string | undefined)[]) => {
    for (const id of ids) if (id !== undefined && id !== '' && !out.includes(id)) out.push(id);
  };
  if (step.via !== '' && step.via !== 'internal' && moved(model, step.via)) {
    push(model.inverse(step.via).changes);
  }
  for (const r of [...(step.writes ?? []), ...(step.reads ?? [])]) {
    const schema = r.split('#')[0] ?? r;
    if (moved(model, schema) || model.rollup(schema).total > 0) push(model.inverse(schema).changes);
  }
  if (moved(model, step.id)) push(model.diff(step.id).map((d) => d.changeId));
  if (out.length === 0) push(model.inverse(step.id).changes);
  return out.filter(isChange);
}

/** The decisions the given changes were made for. */
export const decisionsOf = (model: Model, changes: readonly string[]): string[] => [
  ...new Set(changes.flatMap((id) => strings(prop(model.get(id), 'decisions')))),
];
