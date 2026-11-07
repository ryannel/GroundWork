import { buildId, localId, parseId, rootId } from '@/domain/ids';
import { modelList, modelRecord, modelText } from '@/domain/workspace-model';

import { convertCitations, type MigrationCitations } from './citations';
import { migrateComponent } from './components';
import {
  entryOf,
  errorOf,
  fieldsOf,
  migrateContracts,
  migrateScreens,
  restShapeOf,
  subscriptionOf,
} from './contracts';
import { fingerprint, type MigrationReview } from './review';
import { migrateFailures, migrateSteps, type StepContext } from './steps';

type Node = Readonly<Record<string, unknown>>;
export interface PlanContext {
  readonly path: string;
  readonly review: MigrationReview;
  readonly citations: MigrationCitations;
  readonly placements: ReadonlyMap<string, string>;
}
function object(value: unknown): Node {
  const node = modelRecord(value);
  if (node === null) throw new Error('Expected a plan object.');
  return node;
}
function stepContext(context: PlanContext, target: string): StepContext {
  return {
    path: `${context.path}/${target}`,
    review: context.review,
    cites: [],
    assigned: null,
    cite: (value, inherited) => context.citations.convert(value, inherited),
  };
}
export function migrateFlowStep(value: unknown): Node {
  const node = object(value);
  const id = modelText(node.id) ?? '';
  const { via, ...kept } = node;
  return {
    ...kept,
    id: parseId(id)?.path.at(-1) ?? id,
    ...(via === undefined ? {} : { [parseId(via) === null ? 'transport' : 'via']: via }),
  };
}
function handlerOf(value: Node, context: PlanContext): Node {
  const { fails, failures, ...kept } = value;
  const steps = stepContext(context, modelText(value.id) ?? 'handler');
  const migrated = migrateFailures(modelList(fails ?? failures), steps);
  return {
    ...kept,
    steps: migrateSteps(modelList(value.steps), steps),
    ...(migrated.length === 0 ? {} : { failures: migrated }),
  };
}
function placement(op: Node, value: Node, context: PlanContext): string | null {
  const explicit = modelText(op.into) ?? modelText(value.system);
  if (explicit !== null) return explicit;
  const reference = modelText(value.component) ?? modelText(value.store);
  const inferred = reference === null ? undefined : context.placements.get(rootId(reference));
  if (inferred !== undefined) return inferred;
  const key = `${context.path}/placement/${fingerprint(op)}`;
  const accepted = modelRecord(
    context.review.add('placements', key, op, {
      op,
      reason: 'No containing domain or system is declared for this new entity.',
    }),
  );
  return modelText(accepted?.into);
}
function planComponent(kind: string, value: Node, context: PlanContext): Node {
  const legacyKind = value.kind;
  const component = Object.fromEntries(
    Object.entries(value).filter(([key]) => !['system', 'kind'].includes(key)),
  );
  let type = component.type ?? 'service';
  if (legacyKind === 'ui') type = 'website';
  if (kind === 'store') type = 'database';
  return migrateComponent({ ...component, type }, [], context.citations, context.review);
}
function regionOf(value: Node): Node {
  const { shows, ...kept } = value;
  return {
    ...kept,
    id: parseId(value.id)?.path.at(-1) ?? value.id,
    ...(shows === undefined ? {} : { summary: shows }),
  };
}
function addValue(kind: string, value: Node, context: PlanContext): Node {
  const converters: Readonly<Record<string, () => Node>> = {
    field: () => fieldsOf([value])[0] ?? {},
    handler: () => handlerOf(value, context),
    endpoint: () => entryOf(value, 'rest', context.review),
    schema: () => object(modelList(migrateContracts({ schemas: [value] }, context).schemas)[0]),
    interface: () =>
      object(modelList(migrateContracts({ interfaces: [value] }, context).interfaces)[0]),
    screen: () => migrateScreens([value], context.citations)[0] ?? {},
    flow: () => ({ ...value, steps: modelList(value.steps).map(migrateFlowStep) }),
    region: () => regionOf(value),
    step: () => migrateFlowStep(value),
    system: () => {
      const { does, ...kept } = value;
      return { ...kept, ...(does === undefined ? {} : { purpose: does }) };
    },
  };
  if (['service', 'store', 'component'].includes(kind)) return planComponent(kind, value, context);
  return converters[kind]?.() ?? value;
}
function modifyFields(value: Node, target: string, context: PlanContext): Node {
  const result: Record<string, unknown> = { ...value };
  const prefix = parseId(target)?.prefix;
  if (prefix === 'h') {
    if (value.steps !== undefined) {
      result.steps = migrateSteps(modelList(value.steps), stepContext(context, target));
    }
    if (value.fails !== undefined) {
      result.failures = migrateFailures(modelList(value.fails), stepContext(context, target));
      delete result.fails;
    }
  }
  if (prefix === 'api') {
    Object.assign(result, restShapeOf(value.sig));
    if (value.errors !== undefined) result.errors = modelList(value.errors).map(errorOf);
  }
  if (value.fields !== undefined) result.fields = fieldsOf(modelList(value.fields));
  if (prefix === 'flow' && value.steps !== undefined) {
    result.steps = modelList(value.steps).map(migrateFlowStep);
  }
  return result;
}
function migrateOp(op: Node, context: PlanContext): readonly Node[] {
  const kind = modelText(op.add);
  if (kind === null) {
    const target = modelText(op.modify);
    if (target === null) return [op];
    return [
      {
        ...op,
        ...Object.fromEntries(
          ['set', 'append'].flatMap((key) =>
            op[key] === undefined ? [] : [[key, modifyFields(object(op[key]), target, context)]],
          ),
        ),
      },
    ];
  }
  const value = object(op.value);
  const converted = addValue(kind, value, context);
  const add = kind === 'service' || kind === 'store' ? 'component' : kind;
  const requiresPlacement = [
    'system',
    'component',
    'handler',
    'schema',
    'screen',
    'interface',
    'message',
    'subscription',
    'job',
    'operation',
    'relationship',
  ].includes(add);
  const into = requiresPlacement ? placement(op, value, context) : modelText(op.into);
  const subscription =
    kind === 'handler' ? subscriptionOf(value, context.citations.convert(value)) : null;
  return [
    ...(subscription === null
      ? []
      : [{ add: 'subscription', ...(into === null ? {} : { into }), value: subscription }]),
    {
      ...op,
      add,
      ...(into === null ? {} : { into }),
      value: subscription === null ? converted : { ...converted, on: subscription.id },
    },
  ];
}
function subscriptionBindings(ops: readonly Node[]): ReadonlySet<string> {
  const handlers = ops.filter((op) => op.add === 'handler');
  return new Set(
    ops.flatMap((op) => {
      if (op.add !== 'subscription' || typeof op.into !== 'string') return [];
      const value = object(op.value);
      const bound = handlers.some((handler) => {
        const handlerValue = object(handler.value);
        return (
          handler.into === op.into &&
          handlerValue.on === value.id &&
          handlerValue.component === value.component
        );
      });
      return bound ? [fingerprint([value.message, value.component])] : [];
    }),
  );
}
function withoutConsumerAppend(op: Node, append: Node): readonly Node[] {
  const remaining = Object.fromEntries(
    Object.entries(append).filter(([key]) => key !== 'consumers'),
  );
  if (Object.keys(remaining).length > 0) return [{ ...op, append: remaining }];
  const kept = Object.fromEntries(Object.entries(op).filter(([key]) => key !== 'append'));
  return Object.keys(kept).length === 1 ? [] : [kept];
}
function messageConsumerAppend(op: Node): Node | null {
  const append = modelRecord(op.append);
  return parseId(op.modify)?.prefix === 'msg' && append?.consumers !== undefined ? append : null;
}
function consumersCovered(op: Node, append: Node, bindings: ReadonlySet<string>): boolean {
  return (
    Array.isArray(append.consumers) &&
    modelList(append.consumers).every(
      (component) =>
        typeof component === 'string' && bindings.has(fingerprint([op.modify, component])),
    )
  );
}
function reconcileConsumers(ops: readonly Node[], context: PlanContext): readonly Node[] {
  const bindings = subscriptionBindings(ops);
  const uncovered = ops.filter((op) => {
    const append = messageConsumerAppend(op);
    return append !== null && !consumersCovered(op, append, bindings);
  });
  if (uncovered.length > 0) {
    const accepted = modelRecord(
      context.review.add('plan-consumers', `${context.path}/consumer-bindings`, ops, {
        operations: ops,
        uncovered,
        reason:
          'A declared message consumer has no matching placed subscription and handler binding in this change. Review the complete operation list, including companion declarations.',
      }),
    );
    return Array.isArray(accepted?.operations) ? modelList(accepted.operations).map(object) : ops;
  }
  return ops.flatMap((op) => {
    const append = messageConsumerAppend(op);
    return append === null ? [op] : withoutConsumerAppend(op, append);
  });
}
export function migratePlan(value: unknown, context: PlanContext): Node {
  const original = object(value);
  let node = original;
  if (original.domain !== undefined || original.context !== undefined) {
    const accepted = modelRecord(
      context.review.add('documents', `plan-context/${context.path}`, original, {
        path: context.path,
        original,
        proposed: null,
        reason:
          'Legacy plan context contains authored narrative and stage identities outside the canonical overlay. Reconcile these into canonical files and provide the reviewed plan; no content is discarded automatically.',
      }),
    );
    if (accepted?.plan !== undefined) {
      node = object(accepted.plan);
      if (node.domain !== undefined || node.context !== undefined) {
        throw new Error('The reviewed plan must use the canonical overlay shape.');
      }
    }
  }
  const converted = object(convertCitations(node, context.citations));
  const meta = object(converted.meta);
  return {
    ...converted,
    meta: {
      ...meta,
      id: buildId('plan', localId(modelText(meta.id) ?? '')),
      ...(meta.programme === undefined
        ? {}
        : { programme: buildId('prog', localId(modelText(meta.programme) ?? '')) }),
    },
    changes: modelList(converted.changes).map((item) => {
      const change = object(item);
      const next = { ...context, path: `${context.path}/${String(change.id)}` };
      return {
        ...change,
        ...(change.ops === undefined
          ? {}
          : {
              ops: reconcileConsumers(
                modelList(change.ops).flatMap((op) => migrateOp(object(op), next)),
                next,
              ),
            }),
      };
    }),
  };
}
