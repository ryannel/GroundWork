import {
  blame,
  opRef,
  touched,
  type CheckContext,
  type Report,
} from '@/application/plan/check-context';
import { actingService, canAccess } from '@/application/plan/graph-queries';
import { parentOf } from '@/application/plan/ids';
import type {
  EndpointNode,
  MessageNode,
  OperationNode,
  StepNode,
  SystemGraph,
} from '@/domain/plan/plan-graph';
import type { PathSegment } from '@/domain/plan/plan-ids';

/** A step's via entity was modified, added, deprecated or removed (so re-check the step). */
function viaChanged(ctx: CheckContext, step: StepNode): boolean {
  const via = step.via;
  return (
    ctx.modsById.has(via) ||
    ctx.addedBy.has(via) ||
    ctx.deprecatedBy.has(via) ||
    ctx.removedBy.has(via)
  );
}

/** A step's data context changed: a schema moved store, store access changed, or its fan-out changed. */
function dataChanged(ctx: CheckContext, g: SystemGraph, step: StepNode): boolean {
  const changed = (id: string): boolean =>
    ctx.modsById.has(id) ||
    ctx.addedBy.has(id) ||
    ctx.removedBy.has(id) ||
    ctx.deprecatedBy.has(id);
  if (g.get(step.via)?.$type === 'operation' && ctx.fanout(g, step).refs.some(changed)) return true;
  if ((step.purges ?? []).some(changed)) return true;
  return [...(step.reads ?? []), ...(step.writes ?? [])].some((ref) => {
    const sid = parentOf(ref) ?? ref;
    if (ctx.modsById.has(sid)) return true;
    const sch = g.get(sid);
    return sch?.$type === 'schema' && sch.store !== undefined && ctx.modsById.has(sch.store);
  });
}

interface StepScope {
  ctx: CheckContext;
  rep: Report;
  g: SystemGraph;
  asIs: boolean;
}

const pathOf =
  (s: StepScope, step: StepNode) =>
  (prop: string, rel: readonly PathSegment[] = [prop]): PathSegment[] =>
    s.asIs ? [...step.$path, ...rel] : blame(s.ctx, step.id, { prop, rel });

function checkFlowsHaveSteps(s: StepScope): void {
  for (const flow of s.g.flows) {
    if (flow.steps.length > 0) continue;
    const empty = `${flow.id} has no steps; give it at least one step`;
    if (s.asIs || s.ctx.addedBy.has(flow.id)) s.rep.err([...flow.$path, 'steps'], empty);
    else {
      const before = s.ctx.asIs.get(flow.id);
      if (before?.$type === 'flow' && before.steps.length > 0) {
        s.rep.err(
          flow.$path,
          `${flow.id} has no steps left in the to-be (every step is removed); remove the flow itself instead`,
        );
      }
    }
  }
}

/** One step being checked: where it sits, and how to point at its props. */
interface StepCheck extends StepScope {
  step: StepNode;
  at: ReturnType<typeof pathOf>;
}

function checkGateway(c: StepCheck, target: OperationNode): void {
  const gw = c.g.get(target.graph);
  const gateway = gw?.$type === 'graph' ? gw.gateway : undefined;
  if (gateway !== undefined && c.step.to !== gateway) {
    c.rep.err(
      c.at('to'),
      `via ${c.step.via} is answered by ${target.graph}'s gateway ${gateway}, so "to" must be ${gateway} (got ${c.step.to})`,
    );
  }
}

function checkClient(c: StepCheck, target: OperationNode): void {
  const { step } = c;
  if (c.g.get(step.from)?.$type !== 'service') {
    c.rep.err(
      c.at('from'),
      `via ${step.via}: "from" must be the service that sends the operation (got ${step.from})`,
    );
  } else if (target.client !== undefined && target.client !== step.from) {
    c.rep.warn(
      c.at('from'),
      `${step.id} sends ${step.via} from ${step.from}, but ${step.via}.client is ${target.client}; make them the same service`,
    );
  }
}

function checkOperationData(c: StepCheck): void {
  const { step } = c;
  for (const d of c.ctx.fanout(c.g, step).data) {
    const store = d.store === null ? undefined : c.g.get(d.store);
    if (d.svc === null || store?.$type !== 'store' || canAccess(store, d.svc, d.rw)) continue;
    const field = d.field === undefined ? '' : ` (for ${d.field})`;
    c.rep.strict(
      c.at('via'),
      `${d.svc} ${d.rw}s ${d.ref ?? store.id}${field} behind ${step.via}, but ${store.id} is owned by ${store.owner}; add ${d.svc} to ${store.id}.access with mode ${d.rw}, or resolve the field from a store it owns`,
    );
  }
}

function checkViaOperation(c: StepCheck): void {
  const { step } = c;
  const target = c.g.get(step.via);
  if (target?.$type !== 'operation') return;
  checkGateway(c, target);
  checkClient(c, target);
  for (const prop of ['reads', 'writes'] as const) {
    if ((step[prop] ?? []).length > 0) {
      c.rep.warn(
        c.at(prop),
        `${step.id} calls ${step.via}, whose ${prop} are derived from the operation's fields (and a mutation's writes); delete ${prop} from the step`,
      );
    }
  }
  checkOperationData(c);
}

function checkViaEndpoint(c: StepCheck, target: EndpointNode): void {
  if (c.step.to === target.$service) return;
  c.rep.err(
    c.at('to'),
    `via ${c.step.via} is served by ${String(target.$service)}, so "to" must be ${String(target.$service)} (got ${c.step.to})`,
  );
}

function checkViaMessage(c: StepCheck, target: MessageNode): void {
  const { step } = c;
  const consumers = target.consumers ?? [];
  if (step.from === target.producer || consumers.includes(step.to) || step.to === target.topic) {
    return;
  }
  const named = consumers.length > 0 ? consumers.join(', ') : 'none';
  c.rep.err(
    c.at('via'),
    `via ${step.via}: "from" must be its producer (${target.producer}) or "to" must be one of its consumers (${named}) or its topic (${target.topic}); publish = from producer to topic, consume = from topic to a consumer (append a new consumer to ${step.via}.consumers)`,
  );
}

function checkDeprecatedVia(c: StepCheck): void {
  const { step } = c;
  const dep = c.asIs ? undefined : c.ctx.deprecatedBy.get(step.via);
  if (dep === undefined) return;
  const by = dep.replacedBy ?? null;
  const replaced = by === null ? '' : ` (replaced by ${by})`;
  c.rep.warn(
    c.at('via'),
    `${step.id} still uses ${step.via} in the to-be, which ${opRef(dep)} deprecates${replaced}; fine during dual-publish (say so in the change's rollout), otherwise add a change that moves this step`,
  );
}

function checkVia(c: StepCheck): void {
  if (c.step.via === 'internal') return;
  const target = c.g.get(c.step.via);
  if (target?.$type === 'endpoint') checkViaEndpoint(c, target);
  else if (target?.$type === 'message') checkViaMessage(c, target);
  checkViaOperation(c);
  checkDeprecatedVia(c);
}

function checkPurge(c: StepCheck, [i, sid]: readonly [number, string], actor: string | null): void {
  const { step } = c;
  const st = c.g.get(sid);
  if (st?.$type !== 'store') return;
  const at = c.at('purges', ['purges', i]);
  if (st.kind !== 'cache') {
    c.rep.warn(at, `${step.id} purges ${sid}, a ${st.kind}; purges names kind: cache stores`);
  }
  const callsOwner =
    c.g.get(step.via)?.$type === 'endpoint' &&
    st.owner === step.to &&
    c.g.get(step.from)?.$type === 'service';
  const purger = callsOwner ? step.from : actor;
  if (purger !== null && !canAccess(st, purger, 'write')) {
    c.rep.strict(
      at,
      `${purger} (the acting service) purges ${sid}, but only its owner (${st.owner}) or a service with write access may; add ${purger} to ${sid}.access with mode write`,
    );
  }
}

function checkReadWrite(
  c: StepCheck,
  [prop, need, i, ref]: readonly ['reads' | 'writes', 'read' | 'write', number, string],
  actor: string,
): void {
  const sch = c.g.get(parentOf(ref) ?? ref);
  if (sch?.$type !== 'schema' || sch.kind !== 'record' || sch.store === undefined) return;
  const store = c.g.get(sch.store);
  if (store?.$type !== 'store' || canAccess(store, actor, need)) return;
  c.rep.strict(
    c.at(prop, [prop, i]),
    `${actor} (the acting service) ${need}s ${sch.id} in ${store.id}, but only its owner (${store.owner}) or a service with ${need} access may; add ${actor} to ${store.id}.access or use its own projection`,
  );
}

function checkAccess(c: StepCheck): void {
  const actor = actingService(c.g, c.step);
  for (const entry of (c.step.purges ?? []).entries()) checkPurge(c, entry, actor);
  if (c.g.get(c.step.via)?.$type === 'operation' || actor === null) return;
  for (const [i, ref] of (c.step.reads ?? []).entries()) {
    checkReadWrite(c, ['reads', 'read', i, ref], actor);
  }
  for (const [i, ref] of (c.step.writes ?? []).entries()) {
    checkReadWrite(c, ['writes', 'write', i, ref], actor);
  }
}

function checkStep(s: StepScope, step: StepNode): void {
  if (
    !s.asIs &&
    !touched(s.ctx, step.id) &&
    !viaChanged(s.ctx, step) &&
    !dataChanged(s.ctx, s.g, step)
  )
    return;
  const c: StepCheck = { ...s, step, at: pathOf(s, step) };
  checkVia(c);
  checkAccess(c);
}

/** Checks 5, 6, 9, 19, 21: flows have steps; via, reads, writes and purges agree with the data. */
export function checkSteps(ctx: CheckContext, rep: Report): void {
  for (const g of [ctx.asIs, ctx.toBe]) {
    const s: StepScope = { ctx, rep, g, asIs: g === ctx.asIs };
    checkFlowsHaveSteps(s);
    for (const step of g.steps) checkStep(s, step);
  }
}
