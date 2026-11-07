import { permalinkOf } from '@/domain/code-links';
import { appendChild, failureId } from '@/domain/ids';
import {
  modelList,
  modelRecord,
  modelText,
  type ModelCite,
  type ModelEntity,
} from '@/domain/workspace-model';

import { entryFlowHref, type EntryFlowAddress } from './entry-flow-paths';
import type { ModelIndex } from './model-index';

export type EntryFlowContext = Pick<EntryFlowAddress, 'plan' | 'version'>;

export interface FlowCitation {
  readonly label: string;
  readonly href: string | null;
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
  readonly contract: string | null;
  readonly drills: readonly { readonly label: string; readonly href: string }[];
}
export interface FlowSummary {
  readonly label: string;
  readonly site: string;
}
export interface EntryFlowView {
  readonly id: string;
  readonly title: string;
  readonly kind: string;
  readonly component: string;
  readonly summary: string | null;
  readonly callers: readonly FlowSummary[];
  readonly effects: readonly FlowSummary[];
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
function contractOf(data: Readonly<Record<string, unknown>>, index: ModelIndex): string | null {
  const target = targetOf(data);
  const entity = target === null ? null : index.get(target);
  if (entity === null) return null;
  return JSON.stringify({ ...entity.data, id: entity.id, kind: entity.kind }, null, 2);
}
function drillsOf(
  data: Readonly<Record<string, unknown>>,
  index: ModelIndex,
  context: EntryFlowContext,
): FlowNode['drills'] {
  const cause = index.get(modelText(data.causes) ?? '');
  const direct = modelText(cause?.data.on) ?? modelText(data.call);
  const entry = direct === null ? null : (index.flowOf(direct)?.entry.id ?? null);
  const message = modelText(data.publish);
  const subscriptions = message === null ? [] : index.subscriptions(message);
  const targets = entry === null ? subscriptions : [entry, ...subscriptions];
  return [...new Set(targets)].map((target) => ({
    label: index.label(target),
    href: entryFlowHref(index.model.id, { ...context, entry: target }),
  }));
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
    contract: contractOf(data, index),
    drills: drillsOf(data, index, context),
  };
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
    callers: flow.callers.map((edge) => ({ label: index.label(edge.from), site: edge.site })),
    effects: flow.reaches.map((edge) => ({
      label: `${edge.kind} · ${index.label(edge.to)}`,
      site: edge.site,
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
