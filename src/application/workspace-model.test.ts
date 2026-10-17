import { describe, expect, it, vi } from 'vitest';

import { acme } from '@/../test/workspace-kit';
import { componentsOf } from '@/domain/workspace';

import { systemModelOf } from './workspace-model';

vi.mock(import('server-only'), () => ({}));

const { checkPlanData } = await import('@/infrastructure/plan-validator');

const { workspace, model: read } = acme();
const { plan, model, attribution, scans } = systemModelOf(workspace, read);

describe('systemModelOf', () => {
  it('assembles a document the plan schema and checks accept without errors', async () => {
    const check = await checkPlanData(structuredClone(plan));
    expect(check.errors).toEqual([]);
    expect(
      check.warnings.filter(({ message }) => !/has only one service|has no sources/u.test(message)),
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
    const products = plan.services.find(({ id }) => id === 'svc:products');
    expect(products).toMatchObject({ team: 'team:catalogue', system: 'sys:products' });
    expect(products?.summary).toMatch(/product\.changed/u);
    expect(plan.stores?.find(({ id }) => id === 'st:orders-db')?.owner).toBe('svc:order-api');
    expect(attribution['svc:products']?.origin).toBe('extracted');
    expect(attribution['flow:place-order']?.origin).toBe('curated');
    expect(scans.map(({ repo }) => repo)).toEqual(['acme/ordering']);
  });
});
