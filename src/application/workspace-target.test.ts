import { describe, expect, it } from 'vitest';

import { acme } from '@/../test/workspace-kit';

import { targetStagesOf } from './domain-nav';
import { targetViewOf, targetWarnings } from './workspace-target';

const { today } = acme();

describe('a domain target architecture', () => {
  it('names every owner, citation and earlier stage for the page', () => {
    const view = targetViewOf(today, 'orders')!;
    expect(view.stages.map((stage) => [stage.name, stage.term, stage.from])).toEqual([
      ['Order', 'Order', []],
      ['Payment', null, ['Order']],
    ]);
    expect(view.stages[0]!.owners.map((chip) => chip.label)).toEqual(['Ordering']);
    expect(Object.keys(view.refs).toSorted((a, b) => a.localeCompare(b))).toEqual([
      'svc:order-api',
      'svc:payments',
      'sys:ordering',
    ]);
    expect(view.shifts[0]!.cites.map((chip) => chip.id)).toEqual(['st:order-events']);
  });

  it('is missing where a domain has written none', () => {
    expect(targetViewOf(today, 'catalogue')).toBeNull();
    expect(targetStagesOf(today.targets, 'orders')).toBe(2);
    expect(targetStagesOf(today.targets, 'catalogue')).toBe(0);
  });

  it('warns about ids today does not have, stages that do not exist and ids written twice', () => {
    expect(targetWarnings(today)).toEqual([]);
    const [orders] = today.targets;
    const [order, payment] = orders!.stages;
    const broken = {
      ...orders!,
      summary: 'Ends at [[svc:gone]].',
      stages: [
        { ...order!, term: 'term:nothing', owners: ['sys:nowhere'] },
        { ...payment!, from: ['refund'] },
        payment!,
      ],
      shifts: orders!.shifts.map((shift) => ({ ...shift, cites: ['st:gone'] })),
    };
    const at = 'domains/orders/target.yaml';
    expect(targetWarnings({ ...today, targets: [broken] })).toEqual([
      `${at}: stage payment is written twice`,
      `${at}: the summary cites svc:gone, which today's model does not have`,
      `${at}: stage order is term:nothing, which is not a key term in language.yaml`,
      `${at}: stage order names sys:nowhere, which today's model does not have`,
      `${at}: stage payment is made from refund, which is not a stage`,
      `${at}: shift pay-first cites st:gone, which today's model does not have`,
    ]);
  });
});
