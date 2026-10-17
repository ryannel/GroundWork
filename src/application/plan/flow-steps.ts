import type { Model } from '@/application/plan/derive';
import { prop } from '@/application/plan/ids';
import type { FlowNode, StepNode } from '@/domain/plan/plan-graph';
import type { Flow } from '@/domain/plan/plan.generated';

/** What the flow functions read from a model. */
export type FlowModel = Pick<Model, 'asIs' | 'toBe' | 'get' | 'status' | 'edges'>;

/** A step; in a diff, `$removed` marks one the plan takes away. */
export type FlowStep = StepNode & { readonly $removed?: boolean };

/** Which steps a view reads: as-is, to-be, or to-be with the removed steps struck in. */
export type FlowMode = 'asIs' | 'toBe' | 'diff';

export type StepKind = 'api' | 'msg' | 'data' | 'internal';

const kindOf = (model: FlowModel, id: string | undefined): unknown => prop(model.get(id), 'kind');
const typeOf = (model: FlowModel, id: string | undefined): unknown => prop(model.get(id), '$type');

const isStoreId = (model: FlowModel, id: string): boolean =>
  typeOf(model, id) === 'store' || id.startsWith('st:');

/** A topic or a queue: where events wait. */
export function isTopic(model: FlowModel, id: string): boolean {
  const kind = kindOf(model, id);
  return isStoreId(model, id) && (kind === 'topic' || kind === 'queue');
}

/** The flow with this id in a graph, when it is one. */
export function flowIn(graph: FlowModel['asIs'], id: string): FlowNode | undefined {
  const node = graph.get(id);
  return node?.$type === 'flow' ? node : undefined;
}

/** To-be steps with the as-is steps the plan removes put back where they were. */
function withRemoved(base: readonly FlowStep[], asIs: FlowNode): FlowStep[] {
  const out = [...base];
  const have = new Set(base.map((s) => s.id));
  for (const [i, s] of asIs.steps.entries()) {
    if (have.has(s.id)) continue;
    const prevId = asIs.steps[i - 1]?.id;
    const at = prevId === undefined ? 0 : out.findIndex((x) => x.id === prevId) + 1;
    out.splice(at, 0, { ...s, $removed: true });
    have.add(s.id);
  }
  return out;
}

/** The flow's steps for a mode; diff = to-be steps with removed as-is steps interleaved where they were. */
export function flowSteps(model: FlowModel, flowId: string, mode: FlowMode = 'toBe'): FlowStep[] {
  const asIs = flowIn(model.asIs, flowId);
  const toBe = flowIn(model.toBe, flowId);
  if (mode === 'asIs') return [...((asIs ?? toBe)?.steps ?? [])];
  const base: FlowStep[] = [...((toBe ?? asIs)?.steps ?? [])];
  return mode === 'diff' && asIs !== undefined ? withRemoved(base, asIs) : base;
}

const JOB_WORDS = /\b(?:cron\w*|job|scheduler|nightly)\b/iu;

/** Is this flow started by a job rather than a person? */
export function isJob(
  model: FlowModel,
  flow:
    | (Pick<Flow, 'actor' | 'trigger'> & { readonly steps: readonly Pick<StepNode, 'from'>[] })
    | undefined,
): boolean {
  const first = flow?.steps[0]?.from;
  return (
    kindOf(model, first) === 'job' || JOB_WORDS.test(`${flow?.actor ?? ''} ${flow?.trigger ?? ''}`)
  );
}

export const isSync = (via: string | undefined): boolean => /^(?:api|gql):/u.test(via ?? '');

/** api (a call that waits for its answer, REST or GraphQL) · msg (an event) · data (to or from a store) · internal. */
export function stepKind(model: FlowModel, s: Pick<StepNode, 'via' | 'from' | 'to'>): StepKind {
  if (isSync(s.via)) return 'api';
  if (s.via.startsWith('msg:')) return 'msg';
  return isStoreId(model, s.from) || isStoreId(model, s.to) ? 'data' : 'internal';
}

const knownPairs = new WeakMap<object, Set<string>>();

/** Does today's system already join the step's two ends (or does it stay inside one service)? */
export function knownPath(model: FlowModel, s: Pick<StepNode, 'from' | 'to'>): boolean {
  if (s.from === '' || s.to === '') return false;
  if (!model.asIs.has(s.from) || !model.asIs.has(s.to)) return false;
  if (s.from === s.to) return true;
  const pairs =
    knownPairs.get(model) ?? new Set(model.edges('asIs', 'all').map((e) => `${e.from}>${e.to}`));
  knownPairs.set(model, pairs);
  return pairs.has(`${s.from}>${s.to}`);
}

/**
 * A step that goes where no step goes today: its endpoint or event is new, or today's flows never join its two
 * ends. A step inside one service is never a new link.
 */
export function isNewLink(model: FlowModel, s: FlowStep): boolean {
  if (s.$removed === true) return false;
  if (s.via !== '' && s.via !== 'internal' && model.status(s.via) === 'added') return true;
  if (s.from === '' || s.to === '' || s.from === s.to) return false;
  return !knownPath(model, s);
}
