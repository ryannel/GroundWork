import { permalinkOf } from '@/domain/code-links';
import { appendChild, failureId, rootId } from '@/domain/ids';
import {
  modelList,
  modelRecord,
  modelText,
  type ModelCite,
  type ModelEntity,
} from '@/domain/workspace-model';

import { entryFlowHref, type EntryFlowAddress } from './entry-flow-paths';
import type { ModelIndex } from './model-index';
import { thingHref } from './thing-paths';

export type EntryFlowContext = Pick<EntryFlowAddress, 'plan' | 'version'> & {
  readonly planSlug?: string;
};

export interface FlowCitation {
  readonly label: string;
  readonly href: string | null;
}
interface FlowLink {
  readonly label: string;
  readonly href: string;
}
export interface FlowBranch {
  readonly label: string;
  readonly nodes: readonly FlowNode[];
}
export interface FlowNode {
  readonly id: string;
  readonly title: string;
  readonly kind: string;
  readonly detail: string;
  readonly condition: string | null;
  readonly async: boolean;
  readonly branches: readonly FlowBranch[];
  readonly citations: readonly FlowCitation[];
  readonly contract: {
    readonly detail: string;
    readonly schema: FlowLink | null;
  } | null;
  readonly drills: readonly FlowLink[];
  readonly later: FlowLink | null;
}
export interface FlowSummary {
  readonly label: string;
  readonly site: string;
}
interface FlowEffect extends FlowSummary {
  readonly target: string;
  readonly targetLabel: string;
}
interface FlowFact {
  readonly label: string;
  readonly value: string;
}
export interface EntryFlowView {
  readonly id: string;
  readonly title: string;
  readonly kind: string;
  readonly component: string;
  readonly summary: string | null;
  readonly schemas: readonly FlowLink[];
  readonly callers: readonly FlowSummary[];
  readonly starts: readonly FlowFact[];
  readonly contract: readonly FlowFact[];
  readonly effects: readonly FlowEffect[];
  readonly handlers: readonly {
    readonly id: string;
    readonly summary: string | null;
    readonly nodes: readonly FlowNode[];
    readonly failures: readonly FlowNode[];
  }[];
  readonly gaps: readonly string[];
}
function citationOf(cite: ModelCite): FlowCitation {
  if (cite.kind === 'evidence') return { label: cite.id, href: null };
  const lines = cite.lines === undefined ? '' : `:${cite.lines.join('–')}`;
  return {
    label: `${cite.repo}/${cite.path}${lines} @ ${cite.commit}`,
    href: permalinkOf(cite),
  };
}
function providerOf(entry: ModelEntity, index: ModelIndex): string {
  if (entry.place.component !== null) return index.label(entry.place.component);
  const provider = index.get(entry.parent ?? '');
  const system = modelText(provider?.data.system);
  if (system !== null) return `${index.label(system)} (unmapped)`;
  const external = modelText(provider?.data.external);
  return external === null ? 'Component not recorded' : `${index.label(external)} (external)`;
}
function targetOf(data: Readonly<Record<string, unknown>>): string | null {
  for (const key of ['call', 'read', 'write', 'publish', 'causes']) {
    const target = modelText(data[key]);
    if (target !== null) return target;
  }
  return null;
}
function shapeOf(data: Readonly<Record<string, unknown>>): string {
  if (data.if !== undefined) {
    const then = modelList(data.then);
    return data.else === undefined &&
      then.length === 1 &&
      modelRecord(then[0])?.return !== undefined
      ? 'guard'
      : 'if';
  }
  for (const key of [
    'transaction',
    'each',
    'parallel',
    'try',
    'retry',
    'read',
    'write',
    'call',
    'publish',
    'wait',
    'return',
  ]) {
    if (data[key] !== undefined) return key;
  }
  return 'step';
}
function titleOf(data: Readonly<Record<string, unknown>>, index: ModelIndex): string {
  const say = modelText(data.say);
  if (say !== null) return say;
  const does = modelText(data.does);
  if (does !== null && does.length <= 60) return does;
  for (const value of [data.if, data.each, modelRecord(data.retry)?.until]) {
    const condition = modelText(value);
    if (condition !== null) return condition;
  }
  const kind = shapeOf(data);
  const target = targetOf(data);
  if (target !== null) return `${kind} · ${index.label(target)}`;
  if (kind === 'return' || kind === 'wait') return `${kind} ${String(data[kind])}`;
  return kind === 'step' ? 'Recorded step' : kind;
}
function schemaLink(
  id: string,
  index: ModelIndex,
  context: EntryFlowContext,
  prefix: string,
): FlowLink | null {
  const schema = index.get(rootId(id));
  if (schema?.kind !== 'schema') return null;
  const label = `${prefix} · ${index.label(schema.id)}`;
  if (context.plan === undefined) return { label, href: index.href(schema.id) };
  if (context.planSlug === undefined) return null;
  const base = thingHref({ workspace: index.model.id, slug: context.planSlug }, schema.id);
  return { label, href: context.version === 'before' ? `${base}&view=before` : base };
}
function contractOf(
  data: Readonly<Record<string, unknown>>,
  index: ModelIndex,
  context: EntryFlowContext,
): FlowNode['contract'] {
  const target = targetOf(data);
  const entity = target === null ? null : index.get(target);
  if (entity === null) return null;
  return {
    detail: JSON.stringify({ ...entity.data, id: entity.id, kind: entity.kind }, null, 2),
    schema: schemaLink(entity.id, index, context, 'Open schema'),
  };
}
function linkToEntry(entry: string, index: ModelIndex, context: EntryFlowContext): FlowLink {
  return { label: index.label(entry), href: entryFlowHref(index.model.id, { ...context, entry }) };
}
function recordedEntry(value: unknown, index: ModelIndex): string | null {
  const id = modelText(value);
  return id === null ? null : (index.flowOf(id)?.entry.id ?? null);
}
function linksFrom(
  data: Readonly<Record<string, unknown>>,
  index: ModelIndex,
  context: EntryFlowContext,
): Pick<FlowNode, 'drills' | 'later'> {
  const cause = index.get(modelText(data.causes) ?? '');
  const later = recordedEntry(cause?.data.on, index);
  const call = recordedEntry(data.call, index);
  const message = modelText(data.publish);
  const subscriptions = message === null ? [] : index.subscriptions(message);
  const targets = [later, call, ...subscriptions].filter((target) => target !== null);
  return {
    drills: [...new Set(targets)].map((target) => linkToEntry(target, index, context)),
    later: later === null ? null : linkToEntry(later, index, context),
  };
}
function branchOf(
  label: string,
  values: unknown,
  parent: string,
  index: ModelIndex,
  context: EntryFlowContext,
): FlowBranch {
  return {
    label,
    nodes: modelList(values).map((value) => {
      const data = modelRecord(value);
      const id = modelText(data?.id);
      if (data === null || id === null) {
        throw new Error(`${parent}: a flow step needs its authored identity.`);
      }
      return nodeOf(appendChild(parent, id), data, index, context);
    }),
  };
}
function branchesOf(
  data: Readonly<Record<string, unknown>>,
  id: string,
  index: ModelIndex,
  context: EntryFlowContext,
): readonly FlowBranch[] {
  const branches = ['steps', 'then', 'else', 'try', 'catch', 'finally'].flatMap((key) =>
    data[key] === undefined ? [] : [branchOf(key, data[key], id, index, context)],
  );
  const lanes = modelList(data.parallel).map((lane) => {
    const record = modelRecord(lane);
    return branchOf(modelText(record?.lane) ?? 'Unnamed lane', record?.steps, id, index, context);
  });
  const retry = modelRecord(data.retry);
  const continuation: readonly FlowBranch[] =
    shapeOf(data) === 'guard' ? [{ label: 'otherwise', nodes: [] }] : [];
  return [
    ...branches,
    ...continuation,
    ...lanes,
    ...(retry?.exhausted === undefined
      ? []
      : [branchOf('exhausted', retry.exhausted, id, index, context)]),
  ];
}
function nodeOf(
  id: string,
  data: Readonly<Record<string, unknown>>,
  index: ModelIndex,
  context: EntryFlowContext,
): FlowNode {
  return {
    id,
    title: titleOf(data, index),
    kind: shapeOf(data),
    detail: JSON.stringify(data, null, 2),
    condition: modelText(data.when),
    async: data.async === true,
    branches: branchesOf(data, id, index, context),
    citations: index.cites(id).map(citationOf),
    contract: contractOf(data, index, context),
    ...linksFrom(data, index, context),
  };
}
function factsOf(
  data: Readonly<Record<string, unknown>>,
  fields: readonly (readonly [string, string])[],
): FlowFact[] {
  return fields.flatMap(([key, label]) => {
    const value = modelText(data[key]);
    return value === null ? [] : [{ label, value }];
  });
}
function startsOf(entry: ModelEntity, index: ModelIndex): readonly FlowFact[] {
  const facts = factsOf(entry.data, [
    ['cron', 'Schedule'],
    ['every', 'Every'],
    ['trigger', 'Trigger'],
  ]);
  const screen = entry.kind === 'interaction' ? modelText(entry.data.on) : null;
  return screen === null ? facts : [...facts, { label: 'Screen', value: index.label(screen) }];
}
function contractFacts(entry: ModelEntity): readonly FlowFact[] {
  const facts = factsOf(entry.data, [
    ['sig', 'Signature'],
    ['method', 'Method'],
    ['path', 'Path'],
    ['rpc', 'RPC'],
    ['action', 'Action'],
  ]);
  return [
    ...facts,
    ...modelList(entry.data.errors).flatMap((item) => {
      const error = modelRecord(item);
      const status = error?.status;
      if (typeof status !== 'string' && typeof status !== 'number') return [];
      return [
        {
          label: `Error ${String(status)}`,
          value: modelText(error?.when) ?? 'No condition recorded',
        },
      ];
    }),
  ];
}

/** Project flowOf once on the server. Only the selected flow's plain values cross into the browser. */
export function entryFlowOf(
  index: ModelIndex,
  entry: string,
  context: EntryFlowContext = {},
): EntryFlowView | null {
  const flow = index.flowOf(entry);
  if (flow === null) return null;
  return {
    id: flow.entry.id,
    title: index.label(flow.entry.id),
    kind: flow.entry.kind,
    component: providerOf(flow.entry, index),
    summary: modelText(flow.entry.data.summary),
    schemas: (
      [
        ['request', 'Request'],
        ['response', 'Response'],
      ] as const
    ).flatMap(([key, label]) => {
      const reference = modelText(flow.entry.data[key]);
      const link = reference === null ? null : schemaLink(reference, index, context, label);
      return link === null ? [] : [link];
    }),
    starts: startsOf(flow.entry, index),
    contract: contractFacts(flow.entry),
    callers: flow.callers.map((edge) => ({ label: index.label(edge.from), site: edge.site })),
    effects: flow.reaches.map((edge) => ({
      label: `${edge.kind} · ${index.label(edge.to)}`,
      site: edge.site,
      target: edge.to,
      targetLabel: index.label(edge.to),
    })),
    handlers: flow.handlers.map((handler) => ({
      id: handler.id,
      summary: handler.summary ?? null,
      nodes: branchOf('steps', handler.steps, handler.id, index, context).nodes,
      failures: (handler.failures ?? []).map((failure) =>
        nodeOf(failureId(handler.id, failure.id), failure, index, context),
      ),
    })),
    gaps: flow.gaps.map((gap) => `${gap.id}: ${gap.message}`),
  };
}
