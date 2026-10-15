import {
  scoped,
  whereAt,
  type CheckContext,
  type PropRef,
  type Report,
} from '@/application/plan/check-context';
import { linkOf, stepRefs, walkHandler, type StepRef } from '@/application/plan/handler-walk';
import { parentOf, typeOf } from '@/application/plan/ids';
import type { HandlerNode, PlanNode, SystemGraph } from '@/domain/plan/plan-graph';
import type { HandlerSource } from '@/domain/plan/plan.generated';

// Handlers say what runs inside a component. Every id they name must exist, what starts one must reach its
// component, a scanned handler must say where in the code it was read, and the flows must agree with them.

const DANGLING =
  'fix the id, or define it (in the base arrays if it runs today, as an add op if the plan introduces it)';

interface Scope {
  ctx: CheckContext;
  rep: Report;
  g: SystemGraph;
}

const at = (s: Scope, node: { id: string; $path: PlanNode['$path'] }, ref: PropRef) =>
  whereAt({ ctx: s.ctx, g: s.g }, node, ref);

function checkStepRef(s: Scope, h: HandlerNode, [ref, rel]: [StepRef, PlanNode['$path']]): void {
  const where = at(s, h, { prop: 'steps', rel: [...rel, ref.prop] });
  const type = typeOf(ref.id);
  if (!s.g.has(ref.id)) s.rep.err(where, `${ref.id} does not exist; ${DANGLING}`);
  else if (type === null || !ref.expect.includes(type)) {
    s.rep.err(where, `${ref.id} is a ${String(type)}; expected ${ref.expect.join(' or ')}`);
  }
}

const unsourced = (x: { origin?: string; sources?: HandlerSource[] }): boolean =>
  x.origin === 'extracted' && (x.sources ?? []).length === 0;

function checkSteps(s: Scope, h: HandlerNode): void {
  for (const w of walkHandler(h)) {
    for (const ref of stepRefs(w.step)) checkStepRef(s, h, [ref, w.path]);
    if (unsourced(w.step)) {
      s.rep.err(
        at(s, h, { prop: 'steps', rel: [...w.path, 'origin'] }),
        'an extracted step must say where it was read: add sources ({repo, path, lines, commit})',
      );
    }
  }
}

/** The services whose screens an interaction starts from. */
function interactionServices(g: SystemGraph, n: PlanNode & { $type: 'interaction' }): string[] {
  return n.from.flatMap((id) => {
    const screen = g.get(parentOf(id) ?? id);
    return screen?.$type === 'screen' ? [screen.service] : [];
  });
}

/** Why what starts a handler does not reach its component, or null when it does. */
function onMismatch(g: SystemGraph, h: HandlerNode): string | null {
  const n = g.get(h.on);
  if (n?.$type === 'endpoint' && n.$service !== h.component) {
    return `${h.on} is served by ${String(n.$service)}, not ${h.component}; move the handler to that component or point it at one of ${h.component}'s endpoints`;
  }
  if (n?.$type === 'message' && !(n.consumers ?? []).includes(h.component)) {
    return `${h.on} does not list ${h.component} among its consumers; add it there, or point the handler at a message it consumes`;
  }
  if (n?.$type === 'interaction' && !interactionServices(g, n).includes(h.component)) {
    return `${h.on} starts on a screen of another component, not ${h.component}; move the handler or point it at one of its own interactions`;
  }
  return null;
}

function checkOn(s: Scope, h: HandlerNode): void {
  if (h.on.startsWith('job:')) return;
  const where = at(s, h, 'on');
  if (!s.g.has(h.on)) {
    s.rep.err(where, `${h.on} does not exist; ${DANGLING}`);
    return;
  }
  const why = onMismatch(s.g, h);
  if (why !== null) s.rep.err(where, why);
}

function checkHandler(s: Scope, h: HandlerNode): void {
  checkOn(s, h);
  checkSteps(s, h);
  if (unsourced(h)) {
    s.rep.err(
      at(s, h, 'origin'),
      `${h.id} was extracted from code but has no sources; add where it was read ({repo, path, lines, commit})`,
    );
  }
}

/** The endpoints each component's handlers call. */
function callsByComponent(g: SystemGraph): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const h of g.handlers) {
    const calls = map.get(h.component) ?? new Set<string>();
    map.set(h.component, calls);
    for (const w of walkHandler(h)) {
      const link = linkOf(w.step);
      if (link?.kind === 'call') calls.add(link.target);
    }
  }
  return map;
}

/** A flow step that calls an endpoint should match a call in a handler of its caller, once the caller has any. */
function checkFlowCalls(s: Scope, steps: readonly (PlanNode & { $type: 'step' })[]): void {
  const calls = callsByComponent(s.g);
  for (const step of steps) {
    const known = calls.get(step.from);
    if (known === undefined || !step.via.startsWith('api:') || known.has(step.via)) continue;
    s.rep.warn(
      at(s, step, 'via'),
      `${step.id} has ${step.from} call ${step.via}, but none of ${step.from}'s handlers calls it; add the call to the handler that makes it, or fix the flow`,
    );
  }
}

/** Handlers: references, what starts them, where they were read, and the flows that walk over them. */
export function checkHandlers(ctx: CheckContext, rep: Report): void {
  for (const { g, list } of scoped(ctx, (x) => x.handlers)) {
    for (const h of list) checkHandler({ ctx, rep, g }, h);
  }
  for (const { g, list } of scoped(ctx, (x) => x.steps)) checkFlowCalls({ ctx, rep, g }, list);
}
