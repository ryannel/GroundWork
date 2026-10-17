import { typeOf } from '@/application/plan/ids';
import type { EntityType, PathSegment } from '@/domain/plan/plan-ids';
import type { HandlerStep, HandlerSteps } from '@/domain/plan/plan.generated';

// A handler's body is a tree of steps. These helpers flatten it, keeping for each step the forks and loops it
// sits inside, so checks and derivations can say not just "calls B" but "calls B when …, inside a loop".

/** Where a step sits in its handler's tree: the guards around it, in reading order, and what they make it. */
interface Frame {
  readonly path: readonly PathSegment[];
  readonly guards: readonly string[];
  readonly conditional: boolean;
  readonly looped: boolean;
  readonly async: boolean;
}

export interface WalkedStep extends Frame {
  readonly step: HandlerStep;
}

export type HandlerLinkKind = 'call' | 'publish' | 'read' | 'write';

/** What a step reaches outside its component: an endpoint, a message, or a schema in a store. */
export interface HandlerLink {
  readonly kind: HandlerLinkKind;
  readonly target: string;
  readonly store: string | null;
}

interface Branch {
  readonly steps: HandlerSteps | undefined;
  readonly at: readonly PathSegment[];
  readonly guard: string | null;
  readonly conditional?: boolean;
  readonly looped?: boolean;
}

/** The step lists inside a step, each with the guard a reader would say before it. */
function branchesOf(s: HandlerStep): Branch[] {
  if ('if' in s) {
    return [
      { steps: s.then, at: ['then'], guard: `when ${s.if}`, conditional: true },
      { steps: s.else, at: ['else'], guard: `unless ${s.if}`, conditional: true },
    ];
  }
  if ('each' in s) return [{ steps: s.do, at: ['do'], guard: `for each ${s.each}`, looped: true }];
  if ('retry' in s) return [{ steps: s.do, at: ['do'], guard: `retrying ${s.retry}` }];
  if ('try' in s) {
    return [
      { steps: s.try, at: ['try'], guard: null },
      { steps: s.catch, at: ['catch'], guard: 'when that fails', conditional: true },
    ];
  }
  if ('parallel' in s) {
    return s.parallel.map((steps, i) => ({ steps, at: ['parallel', i], guard: 'in parallel' }));
  }
  return [];
}

function own(s: HandlerStep, frame: Frame, path: readonly PathSegment[]): Frame {
  return {
    path,
    guards: s.when === undefined ? frame.guards : [...frame.guards, `when ${s.when}`],
    conditional: frame.conditional || s.when !== undefined,
    looped: frame.looped,
    async: frame.async || s.async === true,
  };
}

function enter(frame: Frame, b: Branch): Frame {
  return {
    path: [...frame.path, ...b.at],
    guards: b.guard === null ? frame.guards : [...frame.guards, b.guard],
    conditional: frame.conditional || b.conditional === true,
    looped: frame.looped || b.looped === true,
    async: frame.async,
  };
}

function visit(steps: HandlerSteps, frame: Frame): readonly WalkedStep[] {
  return [...steps.entries()].flatMap(([i, s]) => {
    const here = own(s, frame, [...frame.path, i]);
    const nested = branchesOf(s).flatMap((b) =>
      b.steps === undefined ? [] : visit(b.steps, enter(here, b)),
    );
    return [{ step: s, ...here }, ...nested];
  });
}

/** Every step of a handler, depth first, with its path from the handler (`['steps', 1, 'else', 0]`). */
export function walkHandler(handler: { readonly steps: HandlerSteps }): readonly WalkedStep[] {
  const root: Frame = {
    path: ['steps'],
    guards: [],
    conditional: false,
    looped: false,
    async: false,
  };
  return visit(handler.steps, root);
}

/** The guards around a step as one readable line, or null when it always runs. */
export const guardText = (guards: readonly string[]): string | null =>
  guards.length === 0 ? null : guards.join(', ');

/** What a step reaches outside its component, or null for work done in place. */
export function linkOf(s: HandlerStep): HandlerLink | null {
  if ('call' in s) return { kind: 'call', target: s.call, store: null };
  if ('publish' in s) return { kind: 'publish', target: s.publish, store: null };
  if ('read' in s) return { kind: 'read', target: s.read, store: s.from };
  if ('write' in s) return { kind: 'write', target: s.write, store: s.to };
  return null;
}

/** An id a step names: the prop it sits in and the types it may point at. */
export interface StepRef {
  readonly prop: string;
  readonly id: string;
  readonly expect: readonly EntityType[];
}

const SCHEMA: readonly EntityType[] = ['schema', 'field'];

/** The ids a step names (not those of the steps inside it). A `return` is an id only when it reads as one. */
export function stepRefs(s: HandlerStep): StepRef[] {
  if ('call' in s) return [{ prop: 'call', id: s.call, expect: ['endpoint'] }];
  if ('publish' in s) return [{ prop: 'publish', id: s.publish, expect: ['message'] }];
  if ('read' in s) {
    return [
      { prop: 'read', id: s.read, expect: SCHEMA },
      { prop: 'from', id: s.from, expect: ['store'] },
    ];
  }
  if ('write' in s) {
    return [
      { prop: 'write', id: s.write, expect: SCHEMA },
      { prop: 'to', id: s.to, expect: ['store'] },
    ];
  }
  if ('return' in s && typeOf(s.return) !== null) {
    return [{ prop: 'return', id: s.return, expect: SCHEMA }];
  }
  return [];
}
