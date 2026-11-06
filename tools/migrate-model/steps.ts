import { appendChild, localId, parseId } from '@/domain/ids';
import { modelList, modelRecord, modelText } from '@/domain/workspace-model';

import { fingerprint, type MigrationReview } from './review';

type Node = Readonly<Record<string, unknown>>;
export interface StepContext {
  readonly path: string;
  readonly review: MigrationReview;
  readonly cites: readonly unknown[];
  readonly assigned: ReadonlyMap<Node, string> | null;
  readonly selectors?: ReadonlyMap<Node, string> | undefined;
  readonly cite: (value: Node, inherited: readonly unknown[]) => readonly unknown[];
}
export function slug(text: string): string {
  return text
    .normalize('NFKD')
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, '-')
    .replaceAll(/^-|-$/gu, '');
}
function candidate(step: Node): string {
  const explicit = modelText(step.id);
  if (explicit !== null) return parseId(explicit)?.path.at(-1) ?? explicit;
  for (const key of ['read', 'write', 'call', 'publish', 'wait', 'return']) {
    const value = step[key];
    if (typeof value === 'string' || typeof value === 'number') {
      return slug(`${key} ${localId(String(value))}`);
    }
  }
  const condition = conditionOf(step);
  return condition === null ? '' : slug(condition);
}
function conditionOf(step: Node): string | null {
  const conditions = [step.if, step.each, modelRecord(step.retry)?.until, step.retry, step.does];
  return conditions.map(modelText).find((value) => value !== null) ?? null;
}

function location(step: Node): string | null {
  const source = modelRecord(modelList(step.sources)[0]);
  if (source === null || typeof source.repo !== 'string' || typeof source.path !== 'string') {
    return null;
  }
  const [start, end] = modelList(source.lines);
  if (typeof start !== 'number' || typeof end !== 'number') return null;
  return [
    source.repo,
    source.path,
    String(start).padStart(12, '0'),
    String(end).padStart(12, '0'),
  ].join('\0');
}
function collisionId(
  step: Node,
  index: number,
  steps: readonly Node[],
  proposed: string,
  context: StepContext,
): string {
  const hash = fingerprint(step);
  const identical = steps.filter((value) => fingerprint(value) === hash).length > 1;
  const selector = context.selectors?.get(step) ?? `steps/${String(index)}`;
  const qualifier = identical ? `${selector}/` : '';
  const key = `${context.path}/${qualifier}step-identity/${hash}`;
  const accepted = modelRecord(
    context.review.add('step-ids', key, step, {
      path: context.path,
      step,
      proposed: proposed === '' ? null : proposed,
      reason: proposed === '' ? 'Missing or equal code location.' : 'Sibling slug collision.',
    }),
  );
  return modelText(accepted?.id) ?? '';
}
function effectCandidate(step: Node, base: string, repeated: boolean): string {
  if (!repeated) return base;
  const store = modelText(step.from) ?? modelText(step.to);
  if (store === null || (step.read === undefined && step.write === undefined)) return base;
  return slug(`${base} ${localId(store)}`);
}
function assignedIds(steps: readonly Node[], context: StepContext): readonly string[] {
  const base = steps.map(candidate);
  const candidates = steps.map((step, index) =>
    effectCandidate(
      step,
      base[index] ?? '',
      base.filter((value) => value === base[index]).length > 1,
    ),
  );
  const locations = steps.map(location);
  const numbered = steps.flatMap((step, index) =>
    candidates[index] === '' ? [{ step, location: locations[index], index }] : [],
  );
  const ordered = numbered.toSorted((a, b) => (a.location ?? '').localeCompare(b.location ?? ''));
  const fallback = new Map<Node, string>();
  for (const [rank, item] of ordered.entries()) {
    const span = item.location;
    if (
      span !== null &&
      span !== undefined &&
      locations.filter((value) => value === span).length === 1
    ) {
      fallback.set(item.step, `step-${String(rank + 1)}`);
    }
  }
  return steps.map((step, index) => {
    const proposed = candidates[index] ?? '';
    if (proposed !== '' && candidates.filter((value) => value === proposed).length === 1) {
      return proposed;
    }
    return fallback.get(step) ?? collisionId(step, index, steps, proposed, context);
  });
}

function laneSteps(value: unknown): readonly unknown[] {
  if (Array.isArray(value)) return value;
  const lane = modelRecord(value);
  return lane?.steps === undefined ? [value] : modelList(lane.steps);
}
function blockChildren(step: Node, context: StepContext): Node {
  const result: Record<string, unknown> = {};
  const enumerate = (
    values: readonly unknown[],
    key: string,
  ): readonly { readonly node: Node; readonly selector: string }[] =>
    values.map((value, index) => {
      const node = modelRecord(value);
      if (node === null) throw new Error(`${context.path}: a child step must be an object.`);
      return { node, selector: `${key}/${String(index)}` };
    });
  const direct = ['steps', 'then', 'else', 'try', 'catch', 'finally', 'do'].flatMap((key) =>
    enumerate(modelList(step[key]), key),
  );
  const lanes = modelList(step.parallel).flatMap((value, index) =>
    enumerate(laneSteps(value), `parallel/${String(index)}`),
  );
  const descriptors = [
    ...direct,
    ...lanes,
    ...enumerate(modelList(modelRecord(step.retry)?.exhausted), 'exhausted'),
  ];
  const children = descriptors.map((item) => item.node);
  const selectors = new Map(descriptors.map((item) => [item.node, item.selector]));
  const ids = assignedIds(children, { ...context, selectors });
  const assigned = new Map(children.map((child, index) => [child, ids[index] ?? '']));
  const next = { ...context, assigned, selectors };
  for (const key of ['steps', 'then', 'else', 'try', 'catch', 'finally']) {
    if (step[key] !== undefined) result[key] = migrateSteps(modelList(step[key]), next);
  }
  if (step.do !== undefined) result.steps = migrateSteps(modelList(step.do), next);
  if (step.parallel !== undefined) {
    result.parallel = modelList(step.parallel).map((value) => {
      const lane = modelRecord(value);
      if (lane?.steps !== undefined) {
        return {
          ...(lane.lane === undefined ? {} : { lane: lane.lane }),
          steps: migrateSteps(modelList(lane.steps), next),
        };
      }
      return { steps: migrateSteps(laneSteps(value), next) };
    });
  }
  return { ...result, ...retryOf(step, next) };
}
function retryOf(step: Node, context: StepContext): Node {
  if (step.retry === undefined) return {};
  const existing = modelRecord(step.retry);
  if (existing === null) {
    context.review.add('retry-conditions', `retry/${context.path}`, step, {
      path: context.path,
      description: step.retry,
      reason:
        'Legacy retry text does not identify a stopping condition; retain its wording without inverting retry-on into until.',
    });
  }
  const retry = existing ?? {
    description: step.retry,
    ...(step.times === undefined ? {} : { times: step.times }),
  };
  return {
    retry: {
      ...retry,
      ...(retry.exhausted === undefined
        ? {}
        : {
            exhausted: migrateSteps(modelList(retry.exhausted), {
              ...context,
              path: context.path,
            }),
          }),
    },
  };
}
function migratedStep(step: Node, id: string, context: StepContext): Node {
  const omitted = new Set([
    'id',
    'origin',
    'sources',
    'do',
    'retry',
    'times',
    'steps',
    'then',
    'else',
    'try',
    'catch',
    'finally',
    'parallel',
    'fails',
  ]);
  const cites = context.cite(step, context.cites);
  const nextPath =
    id === '' ? `${context.path}/pending/${fingerprint(step)}` : appendChild(context.path, id);
  const next = { ...context, path: nextPath, cites, assigned: null };
  const value = {
    ...Object.fromEntries(Object.entries(step).filter(([key]) => !omitted.has(key))),
    id,
    ...blockChildren(step, next),

    ...(cites.length === 0 ? {} : { cites }),
  };
  const does = modelText(step.does);
  if (does === null || does.length <= 60) return value;
  const accepted = modelRecord(
    context.review.add('headlines', next.path, step, { path: next.path, does, say: null }),
  );
  const say = modelText(accepted?.say);
  if (say !== null && (say.length === 0 || say.length > 60)) {
    throw new Error(`Invalid accepted headline: ${next.path}`);
  }
  return say === null ? value : { ...value, say };
}
export function migrateSteps(values: readonly unknown[], context: StepContext): readonly Node[] {
  const steps = values
    .map((value) => {
      const node = modelRecord(value);
      if (node === null) throw new Error(`${context.path}: a step must be an object.`);
      return node;
    })
    .filter(
      (step) =>
        !(
          (step.do !== undefined || step.steps !== undefined) &&
          Object.keys(step).every((key) => ['origin', 'sources', 'do', 'steps'].includes(key)) &&
          modelList(step.do ?? step.steps).length === 0
        ),
    );
  const ids =
    context.assigned === null
      ? assignedIds(steps, context)
      : steps.map((step) => context.assigned?.get(step) ?? '');
  const result = steps.map((step, index) => migratedStep(step, ids[index] ?? '', context));
  const assigned = result.map((step) => step.id).filter((id) => id !== '');
  if (new Set(assigned).size !== assigned.length) {
    throw new Error(`${context.path}: accepted sibling ids are not unique.`);
  }
  return result;
}
export function migrateFailures(values: readonly unknown[], context: StepContext): readonly Node[] {
  const steps: readonly Node[] = values.map((value) => {
    const node = modelRecord(value);
    if (node === null) throw new Error(`${context.path}: a failure must be an object.`);
    return { ...node, does: node.when };
  });
  const ids = assignedIds(steps, context);
  return steps.map((step, index) => ({
    id: ids[index],
    when: step.when,
    return: step.result ?? step.return,
    cites: context.cite(step, context.cites),
  }));
}
