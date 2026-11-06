import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, expect, it, vi } from 'vitest';

import { systemProviderModel } from '@/../test/fixtures/model-queries';
import { entitiesIn, type WorkspaceModel } from '@/domain/workspace-model';
import { readModelPlans } from '@/infrastructure/model-plans';
import { readModel } from '@/infrastructure/read-model';

import { entryFlowOf, type FlowNode } from './entry-flow';
import { modelWorkspaceCardOf } from './entry-flow-library';
import { entryFlowPageOf } from './entry-flow-page';
import { entryFlowHref } from './entry-flow-paths';
import { indexOf } from './model-index';

vi.mock(import('server-only'), () => ({}));
let root: string;
let model: WorkspaceModel;
beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'groundwork-entry-'));
  await cp(path.resolve('test/fixtures/model'), path.join(root, 'model'), { recursive: true });
  const loaded = await readModel('model-fixture', root);
  if (loaded === null) throw new Error('Missing registered fixture');
  model = loaded;
});
afterAll(async () => rm(root, { recursive: true, force: true }));
function flatten(nodes: readonly FlowNode[]): readonly FlowNode[] {
  return nodes.flatMap((node) => [
    node,
    ...node.branches.flatMap((branch) => flatten(branch.nodes)),
  ]);
}
function nodesOf(query: Readonly<Record<string, string>> = {}): readonly FlowNode[] {
  const page = entryFlowPageOf(model, [], { id: 'api-confirm', ...query });
  return (
    page?.flow?.handlers.flatMap((handler) => [...flatten(handler.nodes), ...handler.failures]) ??
    []
  );
}
it('retains every handler identity and authored order, with no runtime index in the serialised projection', () => {
  const flow = entryFlowOf(indexOf(model), 'api:confirm');
  const nodes = nodesOf();
  const expected = entitiesIn(model)
    .filter((entity) => entity.id.startsWith('h:confirm#'))
    .map((entity) => entity.id);
  expect(nodes.map((node) => node.id)).toEqual(expected);
  expect(nodes[0]?.id).toBe('h:confirm#load');
  const serialised = JSON.stringify(flow);
  const parsed: unknown = JSON.parse(serialised);
  expect(parsed).toEqual(flow);
  expect(JSON.stringify(flow)).not.toContain('beforeIndex');
  expect(JSON.stringify(flow)).not.toContain('repository.json');
  expect(flow?.callers).toEqual([{ label: 'Shop', site: 'h:click#submit' }]);
  expect(flow?.effects).toContainEqual({
    label: 'write · Orders database',
    site: 'h:confirm#tx/save',
  });
});
it('renders guard, alternative, transaction, loop, named lanes, retry exhaustion and failures distinctly', () => {
  const nodes = nodesOf();
  const node = (id: string): FlowNode | undefined => nodes.find((candidate) => candidate.id === id);
  expect(node('h:confirm#already-confirmed')?.kind).toBe('guard');
  expect(node('h:confirm#missing')?.kind).toBe('if');
  expect(node('h:confirm#tx')?.kind).toBe('transaction');
  expect(node('h:confirm#lines')?.kind).toBe('each');
  expect(node('h:confirm#enrich')?.branches.map((branch) => branch.label)).toEqual([
    'Order facts',
    'Payment facts',
  ]);
  expect(node('h:confirm#deliver')?.branches.map((branch) => branch.label)).toEqual([
    'steps',
    'exhausted',
  ]);
  expect(node('h:confirm#cleanup')?.branches.map((branch) => branch.label)).toEqual([
    'try',
    'catch',
    'finally',
  ]);
  expect(node('h:confirm#!db-down')?.detail).toContain('The database is unavailable');
  expect(node('h:confirm#lines/reserve')?.condition).toBe('Payment is required');
  expect(node('h:confirm#deliver/send')?.async).toBe(true);
});
it('links code to its pinned lines, keeps evidence references and drills only through recorded targets', () => {
  const nodes = nodesOf();
  expect(nodes.find((node) => node.id === 'h:confirm#tx/save')?.citations[0]?.href).toBe(
    `https://github.com/example/orders/blob/${'a'.repeat(40)}/apps/ordering/src/Confirm.ts#L12-L16`,
  );
  expect(nodes.find((node) => node.id === 'h:confirm#tx/save')?.contract).toContain('status');
  expect(nodes.find((node) => node.id === 'h:confirm#deliver/send')?.drill).toEqual({
    label: 'sub:on-confirmed',
    href: '/model-fixture/entries/?id=sub-on-confirmed',
  });
  expect(nodes.find((node) => node.id === 'h:confirm#lines/reserve')?.drill?.href).toBe(
    '/model-fixture/entries/?id=api-charge',
  );
  expect(nodes.find((node) => node.id === 'h:confirm#tx/queue')?.drill).toBeNull();
  const relay = entryFlowOf(indexOf(model), 'job:relay');
  expect(relay?.handlers[0]?.nodes[0]?.citations).toEqual([{ label: 'ev:source', href: null }]);
});
it('shows absent callers, handlers and timing as gaps rather than inventing them', () => {
  const flow = entryFlowOf(indexOf(model), 'job:unknown');
  expect(flow?.handlers).toEqual([]);
  expect(flow?.callers).toEqual([]);
  expect(flow?.gaps).toContain('job:unknown: No schedule or trigger is recorded.');
  expect(flow?.gaps).toContain('job:unknown: No handler detail is recorded.');
  expect(entryFlowOf(indexOf(model), 'missing')).toBeNull();
});
it('applies one selected overlay independently and sends only the selected before or after flow', async () => {
  const plans = await readModelPlans(model.id, root);
  const before = entryFlowPageOf(model, plans, {
    id: 'api-confirm',
    plan: 'plan-confirm',
    version: 'before',
  });
  const after = entryFlowPageOf(model, plans, {
    id: 'api-confirm',
    plan: 'plan-confirm',
    version: 'after',
  });
  const beforeNodes = before?.flow?.handlers.flatMap((handler) => flatten(handler.nodes)) ?? [];
  const afterNodes = after?.flow?.handlers.flatMap((handler) => flatten(handler.nodes)) ?? [];
  expect(beforeNodes.find((node) => node.id === 'h:confirm#tx/save')?.title).toBe('write · status');
  expect(afterNodes.find((node) => node.id === 'h:confirm#tx/save')?.title).toBe(
    'Save the confirmed order',
  );
  expect(beforeNodes.some((node) => node.id === 'h:confirm#tx/audit')).toBe(false);
  expect(afterNodes.some((node) => node.id === 'h:confirm#tx/audit')).toBe(true);
  expect(after?.flow?.handlers[0]?.failures[0]?.detail).toContain('502');
  expect(before?.flow?.handlers[0]?.failures[0]?.detail).toContain('503');
  expect(JSON.stringify(after)).not.toContain('beforeIndex');
  expect(entryFlowPageOf(model, plans, { id: 'api-confirm', plan: 'plan-missing' })).toBeNull();
  expect(entryFlowPageOf(model, plans, { id: 'api-missing' })).toBeNull();
  expect(entryFlowPageOf(model, plans, { id: 'bad-token' })).toBeNull();
});
it('lists native entries and plans without manufacturing legacy plan progress', () => {
  const page = entryFlowPageOf(model, [], { domain: 'dom-orders' });
  expect(page?.flow).toBeNull();
  expect(page?.entries.some((entry) => entry.id === 'api:confirm')).toBe(true);
  expect(entryFlowPageOf(model, [], { domain: 'dom-other' })?.entries).toEqual([]);
  const card = modelWorkspaceCardOf(model, []);
  expect(card.href).toBe('/model-fixture/entries/');
  expect(card.plans).toEqual([]);
  expect(card.facts).toContain('0 plans');
  expect(
    entryFlowHref(model.id, { entry: 'api:confirm', plan: 'plan:confirm', version: 'after' }),
  ).toBe('/model-fixture/entries/?id=api-confirm&plan=plan-confirm&version=after');
});

it('keeps the explicitly recorded external provider visible when drilling into its entry', () => {
  const flow = entryFlowOf(indexOf(model), 'api:charge');
  expect(flow?.component).toBe('Payments (external)');
  expect(flow?.handlers).toEqual([]);
  expect(flow?.gaps).toContain('api:charge: No handler detail is recorded.');
});

it('shows the named unmapped system and its implementation gap on the entry flow', () => {
  const flow = entryFlowOf(indexOf(systemProviderModel()), 'api:unmapped-api');
  expect(flow?.component).toBe('Unmapped (unmapped)');
  expect(flow?.handlers).toEqual([]);
  expect(flow?.gaps).toContain(
    'api:unmapped-api: The system providing this interface is unmapped; its implementing component is unknown.',
  );
});
