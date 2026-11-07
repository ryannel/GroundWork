import { createHash } from 'node:crypto';

import { nestedId, parseId } from '@/domain/ids';
import type { AuthoredModel } from '@/domain/workspace-model';

type Step = AuthoredModel<'Step'>;
type Lane = AuthoredModel<'Lane'>;
type Alias = AuthoredModel<'Alias'>;

const DIRECT = ['steps', 'then', 'else', 'try', 'catch', 'finally'] as const;

function childSteps(step: Step): readonly Step[] {
  return [
    ...DIRECT.flatMap((key) => step[key] ?? []),
    ...(step.parallel ?? []).flatMap(({ steps }) => steps),
    ...(step.retry?.exhausted ?? []),
  ];
}

function declaredIds(
  steps: readonly Step[],
  handler: string,
  path: readonly string[] = [],
): string[] {
  return steps.flatMap((step) => {
    const child = [...path, step.id];
    return [nestedId(handler, child), ...declaredIds(childSteps(step), handler, child)];
  });
}

export interface StepMatch {
  readonly steps: readonly Step[];
  readonly retired: Readonly<Record<string, Alias>>;
  readonly ambiguities: readonly string[];
  readonly replacements?: ReadonlyMap<string, string>;
}

type SpanOf = (step: Step, side: 'prior' | 'observed') => string | null;

interface StepScope {
  readonly handler: string;
  readonly prior: readonly Step[];
  readonly observed: readonly Step[];
  /** Return a comparable span only after source alignment. */
  readonly span: SpanOf;
  readonly aliases: Readonly<Record<string, Alias | undefined>>;
}

function bySpan(
  steps: readonly Step[],
  span: (step: Step) => string | null,
): Map<string | null, Step[]> {
  const result = new Map<string | null, Step[]>();
  for (const step of steps) {
    const key = span(step);
    const siblings = result.get(key) ?? [];
    siblings.push(step);
    result.set(key, siblings);
  }
  return result;
}

function availableId(proposed: string, span: string, used: ReadonlySet<string>): string {
  if (!used.has(proposed)) return proposed;
  const suffix = createHash('sha256').update(span).digest('hex').slice(0, 12);
  return `${proposed}-${suffix}`;
}

function reservedChildren(
  ids: ReadonlySet<string>,
  handler: string,
  path: readonly string[],
): Set<string> {
  return new Set(
    [...ids].flatMap((id) => {
      const address = parseId(id);
      if (address?.root !== handler || address.failure) return [];
      if (address.path.length !== path.length + 1) return [];
      if (!path.every((part, index) => part === address.path[index])) return [];
      return address.path.slice(-1);
    }),
  );
}

function laneMatches(before: readonly Lane[], candidate: Lane, span: SpanOf): readonly Lane[] {
  const named =
    candidate.lane === undefined ? [] : before.filter(({ lane }) => lane === candidate.lane);
  if (named.length > 0) return named;
  const anchors = new Set(candidate.steps.map((step) => span(step, 'observed')));
  anchors.delete(null);
  return before.filter(({ steps }) => steps.some((step) => anchors.has(span(step, 'prior'))));
}

function reviseChildren(
  candidate: Step,
  previous: Step | undefined,
  group: (prior: readonly Step[], observed: readonly Step[]) => Step[],
  span: SpanOf,
  ambiguous: () => void,
): Step {
  const direct = Object.fromEntries(
    DIRECT.flatMap((key) => {
      const children = candidate[key];
      return children === undefined ? [] : [[key, group(previous?.[key] ?? [], children)]];
    }),
  );
  const result = { ...candidate, ...direct };
  if (candidate.retry?.exhausted !== undefined) {
    result.retry = {
      ...candidate.retry,
      exhausted: group(previous?.retry?.exhausted ?? [], candidate.retry.exhausted),
    };
  }
  if (candidate.parallel !== undefined) {
    const [first, ...remaining] = candidate.parallel;
    const used = new Set<Lane>();
    const revise = (lane: Lane): Lane => {
      const matches = laneMatches(previous?.parallel ?? [], lane, span);
      const old = matches[0];
      if (matches.length > 1 || (old !== undefined && used.has(old))) {
        ambiguous();
        return lane;
      }
      if (old !== undefined) used.add(old);
      return { ...lane, steps: group(old?.steps ?? [], lane.steps) };
    };
    result.parallel = [revise(first), ...remaining.map(revise)];
  }
  return result;
}

interface SiblingMatch {
  readonly old: ReadonlyMap<string | null, readonly Step[]>;
  readonly seen: ReadonlyMap<string | null, readonly Step[]>;
  readonly used: ReturnType<typeof reservedChildren>;
  readonly qualify: (id: string) => string;
  readonly path: readonly string[];
  readonly observedPath: readonly string[];
}

function matchState(scope: StepScope, original: readonly string[]) {
  return {
    scope,
    reserved: new Set([...original, ...Object.keys(scope.aliases)]),
    retained: new Set<string>(),
    replacements: new Map<string, string>(),
    ambiguities: new Array<string>(),
  };
}

type MatchState = ReturnType<typeof matchState>;

function alignedCandidate(
  siblings: SiblingMatch,
  anchor: string | null,
): { readonly anchor: string; readonly previous: Step | undefined } | null {
  if (anchor === null) return null;
  const matches = siblings.old.get(anchor) ?? [];
  if ((siblings.seen.get(anchor)?.length ?? 0) > 1 || matches.length > 1) return null;
  return { anchor, previous: matches[0] };
}

function stepMatch(candidate: Step, state: MatchState, siblings: SiblingMatch): Step {
  const { scope, retained, reserved, ambiguities, replacements } = state;
  const { used, qualify, path, observedPath } = siblings;
  const alignment = alignedCandidate(siblings, scope.span(candidate, 'observed'));
  if (alignment === null) {
    ambiguities.push(qualify(candidate.id));
    return candidate;
  }
  const { anchor, previous } = alignment;
  const id = previous?.id ?? availableId(candidate.id, anchor, used);
  if (previous === undefined && used.has(id)) {
    ambiguities.push(qualify(candidate.id));
    return candidate;
  }
  used.add(id);
  const target = qualify(id);
  const candidatePath = [...observedPath, candidate.id];
  replacements.set(nestedId(scope.handler, candidatePath), target);
  reserved.add(target);
  if (previous !== undefined) retained.add(qualify(id));
  const next = { ...candidate, id, ...(previous?.say === undefined ? {} : { say: previous.say }) };
  return reviseChildren(
    next,
    previous,
    (prior, observed) => matchGroup(prior, observed, [...path, id], candidatePath, state),
    scope.span,
    () => {
      ambiguities.push(qualify(id));
    },
  );
}

function matchGroup(
  prior: readonly Step[],
  observed: readonly Step[],
  path: readonly string[],
  observedPath: readonly string[],
  state: MatchState,
): Step[] {
  const { scope, reserved } = state;
  const old = bySpan(prior, (step) => scope.span(step, 'prior'));
  const qualify = (id: string): string => nestedId(scope.handler, [...path, id]);
  const siblings = {
    old,
    seen: bySpan(observed, (step) => scope.span(step, 'observed')),
    used: reservedChildren(reserved, scope.handler, path),
    qualify,
    path,
    observedPath,
  };
  return observed.map((step) => stepMatch(step, state, siblings));
}

function unalignedSteps(
  steps: readonly Step[],
  scope: StepScope,
  path: readonly string[] = [],
): readonly string[] {
  return steps.flatMap((step) => {
    const child = [...path, step.id];
    const invalid = scope.span(step, 'prior') === null ? [nestedId(scope.handler, child)] : [];
    return [...invalid, ...unalignedSteps(childSteps(step), scope, child)];
  });
}

/** Reconcile a complete source-backed handler observation. Partial scans never call this operation. */
export function reconcileSteps(scope: StepScope): StepMatch {
  const original = declaredIds(scope.prior, scope.handler);
  const unaligned = unalignedSteps(scope.prior, scope);
  if (unaligned.length > 0) return { steps: scope.prior, retired: {}, ambiguities: unaligned };
  const state = matchState(scope, original);
  const steps = matchGroup(scope.prior, scope.observed, [], [], state);
  const { ambiguities, retained, replacements } = state;
  if (ambiguities.length > 0) return { steps: scope.prior, retired: {}, ambiguities };
  const retired = Object.fromEntries(
    original
      .filter((id) => !retained.has(id))
      .map((id) => [
        id,
        {
          to: null,
          reason: 'The complete source-backed handler observation no longer contains this step.',
        },
      ]),
  );
  return { steps, retired, ambiguities, replacements };
}
