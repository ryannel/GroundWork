import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { componentsOf } from '@/domain/workspace';

import { systemModelOf } from './workspace-model';

vi.mock('server-only', () => ({}));

const { readWorkspaces } = await import('@/infrastructure/workspace-store');
const { readWorkspaceModel } = await import('@/infrastructure/workspace-model');
const { checkPlanData } = await import('@/infrastructure/plan-validator');

const root = path.resolve(import.meta.dirname, '../../workspaces');
const workspaces = await readWorkspaces(root);
const workspace = workspaces.find(({ id }) => id === 'alder-finch')!;
const read = await readWorkspaceModel(workspace, root);
const { plan, model, attribution, scans } = systemModelOf(workspace, read);

describe('systemModelOf', () => {
  it('assembles a document the plan schema and checks accept without errors', async () => {
    const check = await checkPlanData(structuredClone(plan));
    expect(check.errors).toEqual([]);
    expect(
      check.warnings.filter(({ message }) => !/has only one service|has no sources/.test(message)),
    ).toEqual([]);
    expect(model.validation().errors).toEqual([]);
  });

  it('draws every component of the structure', () => {
    const drawn = new Set([...model.asIs.services, ...model.asIs.stores].map(({ id }) => id));
    expect(componentsOf(workspace).filter(({ id }) => !drawn.has(id))).toEqual([]);
  });

  it('resolves every step of every flow', () => {
    expect(model.asIs.flows).toHaveLength(read.flows.length);
    const loose = model.asIs.steps.filter(
      (step) => !model.asIs.has(step.from) || !model.asIs.has(step.to),
    );
    expect(loose.map(({ id }) => id)).toEqual([]);
  });

  it('keeps the structure’s words and the model’s detail', () => {
    const allocation = plan.services.find(({ id }) => id === 'svc:allocation');
    expect(allocation).toMatchObject({ team: 'team:fulfilment', system: 'sys:fulfilment' });
    expect(allocation?.summary).toMatch(/order\.placed/);
    expect(plan.stores?.find(({ id }) => id === 'st:wms-db')?.owner).toBe('svc:wms');
    expect(attribution['svc:allocation']?.origin).toBe('seeded');
    expect(scans).toEqual([]);
  });
});
