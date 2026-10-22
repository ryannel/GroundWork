import type { Model } from '@/application/plan/derive';
import { type ChipRef, chipRefOf } from '@/application/today-scope';
import type { HandlerNode } from '@/domain/plan/plan-graph';
import type { HandlerSource, HandlerStep, HandlerSteps } from '@/domain/plan/plan.generated';
import { permalinkOf } from '@/domain/workspace-model';

// What runs when an endpoint is called or a message arrives, read from the code's handlers as a tree a person can
// follow: each step in order, the forks and loops it sits in, and under each call what the callee does in turn.

/** Where a step was read from, as a link to the lines. */
export interface StepCode {
  readonly url: string;
  readonly label: string;
}

interface StepBase {
  readonly key: string;
  /** "when the cart has financed items"; null when the step always runs. */
  readonly when: string | null;
  readonly async: boolean;
  readonly code: StepCode | null;
}

/** A step that stays inside the component. */
export interface DoesStep extends StepBase {
  readonly kind: 'does';
  readonly text: string;
}

/** A step that reaches out: a call, an announcement, a read or a write. */
export interface LinkStep extends StepBase {
  readonly kind: 'link';
  readonly verb: 'Calls' | 'Announces' | 'Reads' | 'Writes';
  readonly chip: ChipRef;
  /** The store a read or write goes to. */
  readonly store: ChipRef | null;
  readonly text: string | null;
  /** What the callee, or each consumer, does in turn. */
  readonly next: readonly HandlerView[];
  /** Why the tree stops here: the handler is already above it, or it is too deep to draw. */
  readonly stop: 'cycle' | 'depth' | null;
  /** The component at the other end, when the model knows it. */
  readonly reaches: string | null;
  /** A call no handler answers yet, so the trail stops here. */
  readonly unread: boolean;
}

/** A step holding other steps: a fork, a loop, a retry, a try, or steps at once. */
export interface BlockStep extends StepBase {
  readonly kind: 'block';
  readonly text: string | null;
  readonly branches: readonly { readonly label: string; readonly steps: readonly StepView[] }[];
}

/** The answer or the wait a handler ends on. */
export interface EndStep extends StepBase {
  readonly kind: 'end';
  readonly text: string;
  /** The schema it answers with, when the model knows it. */
  readonly chip: ChipRef | null;
}

export type StepView = DoesStep | LinkStep | BlockStep | EndStep;

export interface HandlerView {
  readonly id: string;
  readonly on: ChipRef;
  readonly component: ChipRef;
  readonly summary: string | null;
  readonly steps: readonly StepView[];
  readonly fails: readonly { readonly when: string; readonly result: string }[];
  readonly code: StepCode | null;
}

/** What one entry sets off: its handlers, and every system and store reached anywhere below. */
export interface HandlerStory {
  readonly handlers: readonly HandlerView[];
  readonly systems: readonly ChipRef[];
  readonly stores: readonly ChipRef[];
  /** Endpoints it calls that no handler answers yet, so the tree stops there. */
  readonly unread: readonly ChipRef[];
  /** Endpoints it calls on parties outside the map (banks, tax providers, SaaS, teams not read), where the trail ends. */
  readonly outside: readonly ChipRef[];
}

const DEEPEST = 4;

interface Walk {
  readonly model: Model;
  readonly byOn: ReadonlyMap<string, readonly HandlerNode[]>;
  readonly above: ReadonlySet<string>;
  readonly depth: number;
}

/** A step and the key it is drawn under. */
interface At {
  readonly step: HandlerStep;
  readonly key: string;
}

/** "CartService.cs:60–74" from a link to lines on GitHub, or "Code" when the link says nothing of them. */
function labelOfUrl(url: string): string {
  const [where = '', lines = ''] = url.split('#');
  const file = where.split('/').at(-1) ?? '';
  const span = /^L(\d+)(?:-L(\d+))?$/u.exec(lines);
  if (file === '') return 'Code';
  if (span === null) return file;
  const [, from = '', to = from] = span;
  return from === to ? `${file}:${from}` : `${file}:${from}–${to}`;
}

function codeOf(sources: readonly HandlerSource[] | undefined): StepCode | null {
  const first = sources?.[0];
  if (first === undefined) return null;
  if ('url' in first) return { url: first.url, label: first.label ?? labelOfUrl(first.url) };
  const [from, to] = first.lines;
  const lines = from === to ? String(from) : `${String(from)}–${String(to)}`;
  const file = first.path.split('/').at(-1) ?? first.path;
  return { url: permalinkOf(first), label: `${file}:${lines}` };
}

function baseOf({ step, key }: At): StepBase {
  return {
    key,
    when: step.when ?? null,
    async: step.async ?? false,
    code: codeOf(step.sources),
  };
}

function nextOf(walk: Walk, target: string): Pick<LinkStep, 'next' | 'stop' | 'unread'> {
  const callees = walk.byOn.get(target) ?? [];
  if (callees.length === 0) return { next: [], stop: null, unread: target.startsWith('api:') };
  const fresh = callees.filter((h) => !walk.above.has(h.id));
  if (fresh.length > 0 && walk.depth >= DEEPEST) return { next: [], stop: 'depth', unread: false };
  const deeper = { ...walk, depth: walk.depth + 1 };
  return {
    next: fresh.map((h) => viewOf({ ...deeper, above: new Set([...walk.above, h.id]) }, h)),
    stop: fresh.length < callees.length ? 'cycle' : null,
    unread: false,
  };
}

interface Reach {
  readonly verb: LinkStep['verb'];
  readonly target: string;
  readonly store: string | null;
}

function link(walk: Walk, at: At, { verb, target, store }: Reach): LinkStep {
  return {
    ...baseOf(at),
    kind: 'link',
    verb,
    chip: chipRefOf(walk.model, target),
    store: store === null ? null : chipRefOf(walk.model, store),
    text: at.step.does ?? null,
    reaches: walk.model.ownerService(store ?? target),
    ...(verb === 'Calls' || verb === 'Announces'
      ? nextOf(walk, target)
      : { next: [], stop: null, unread: false }),
  };
}

interface Branch {
  readonly label: string;
  readonly steps: HandlerSteps | undefined;
}

function block(walk: Walk, at: At, branches: readonly Branch[]): BlockStep {
  const { step, key } = at;
  return {
    ...baseOf(at),
    kind: 'block',
    text: step.does ?? null,
    branches: branches
      .filter((b) => (b.steps ?? []).length > 0)
      .map((b, i) => ({
        label: b.label,
        steps: stepsOf(walk, b.steps ?? [], `${key}.${String(i)}`),
      })),
  };
}

function end(walk: Walk, at: At, [verb, what]: readonly [string, string]): EndStep {
  const known = walk.model.asIs.get(what) !== undefined;
  return {
    ...baseOf(at),
    kind: 'end',
    text: at.step.does ?? (known ? verb : `${verb} ${what}`),
    chip: known ? chipRefOf(walk.model, what) : null,
  };
}

function reachOf(step: HandlerStep): Reach | null {
  if ('call' in step) return { verb: 'Calls', target: step.call, store: null };
  if ('publish' in step) return { verb: 'Announces', target: step.publish, store: null };
  if ('read' in step) return { verb: 'Reads', target: step.read, store: step.from };
  if ('write' in step) return { verb: 'Writes', target: step.write, store: step.to };
  return null;
}

function branchesOf(step: HandlerStep): Branch[] | null {
  if ('if' in step) {
    return [
      { label: `If ${step.if}`, steps: step.then },
      { label: 'Otherwise', steps: step.else },
    ];
  }
  if ('each' in step) return [{ label: `For each ${step.each}`, steps: step.do }];
  if ('parallel' in step) {
    return step.parallel.map((steps, i) => ({
      label: `At the same time (${String(i + 1)} of ${String(step.parallel.length)})`,
      steps,
    }));
  }
  if ('retry' in step) {
    const times = step.times === undefined ? '' : `, up to ${String(step.times)} times`;
    return [{ label: `Retrying ${step.retry}${times}`, steps: step.do }];
  }
  if ('try' in step) {
    return [
      { label: 'Tries', steps: step.try },
      { label: 'If that fails', steps: step.catch },
    ];
  }
  return null;
}

function stepOf(walk: Walk, at: At): StepView {
  const { step } = at;
  const reach = reachOf(step);
  if (reach !== null) return link(walk, at, reach);
  const branches = branchesOf(step);
  if (branches !== null) return block(walk, at, branches);
  if ('return' in step) return end(walk, at, ['Answers with', step.return]);
  if ('wait' in step) return end(walk, at, ['Waits for', step.wait]);
  return { ...baseOf(at), kind: 'does', text: step.does ?? '' };
}

function stepsOf(walk: Walk, steps: HandlerSteps, key: string): StepView[] {
  return steps.map((step, i) => stepOf(walk, { step, key: `${key}.${String(i)}` }));
}

function viewOf(walk: Walk, h: HandlerNode): HandlerView {
  return {
    id: h.id,
    on: chipRefOf(walk.model, h.on),
    component: chipRefOf(walk.model, h.component),
    summary: h.summary ?? null,
    steps: stepsOf(walk, h.steps, h.id),
    fails: (h.fails ?? []).map(({ when, result }) => ({ when, result })),
    code: codeOf(h.sources),
  };
}

function groupByOn(handlers: readonly HandlerNode[]): Map<string, HandlerNode[]> {
  const map = new Map<string, HandlerNode[]>();
  for (const h of handlers) map.set(h.on, [...(map.get(h.on) ?? []), h]);
  return map;
}

function systemOf(model: Model, component: string): string | null {
  const service = model.asIs.services.find((s) => s.id === component);
  if (service !== undefined) return service.system ?? null;
  const owner = model.ownerService(component);
  return owner === null || owner === component ? null : systemOf(model, owner);
}

/** Every link anywhere under the handlers, deepest included. */
function linksIn(handlers: readonly HandlerView[]): LinkStep[] {
  const inSteps = (steps: readonly StepView[]): LinkStep[] =>
    steps.flatMap((step) => {
      if (step.kind === 'link') return [step, ...linksIn(step.next)];
      if (step.kind === 'block') return step.branches.flatMap((b) => inSteps(b.steps));
      return [];
    });
  return handlers.flatMap((h) => inSteps(h.steps));
}

const unique = <T>(list: readonly T[]): T[] => [...new Set(list)];

/** What runs when `id` is called or arrives, today, followed down every call; null when no handler is known. */
export function handlerStoryOf(model: Model, id: string): HandlerStory | null {
  const byOn = groupByOn(model.asIs.handlers);
  const entry = byOn.get(id) ?? [];
  if (entry.length === 0) return null;
  const handlers = entry.map((h) => viewOf({ model, byOn, above: new Set([h.id]), depth: 0 }, h));
  const links = linksIn(handlers);
  const home = new Set(entry.flatMap((h) => systemOf(model, h.component) ?? []));
  const systems = unique(
    links.flatMap((l) => (l.reaches === null ? [] : (systemOf(model, l.reaches) ?? []))),
  ).filter((s) => s.startsWith('sys:') && !home.has(s));
  const chips = (ids: readonly string[]) => unique(ids).map((x) => chipRefOf(model, x));
  const outsiders = new Set(
    model.asIs.services.filter((svc) => svc.kind === 'external').map((svc) => svc.id),
  );
  const stops = links.flatMap((l) => (l.unread ? [l.chip.id] : []));
  const leaves = (x: string): boolean => outsiders.has(model.ownerService(x) ?? '');
  return {
    handlers,
    systems: chips(systems),
    stores: chips(links.flatMap((l) => (l.store === null ? [] : [l.store.id]))),
    unread: chips(stops.filter((x) => !leaves(x))),
    outside: chips(stops.filter(leaves)),
  };
}
