import { describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';
import { journeyComparison, journeyStep, type JourneyRow } from '@/application/plan/journey';
import type { Plan } from '@/domain/plan/plan.generated';

vi.mock('server-only', () => ({}));

const { readPlan } = await import('@/infrastructure/plan-store');
const { loadFixture } = await import('@/infrastructure/plan-fixture');

const planOf = async (slug: string): Promise<Plan> => {
  const { plan } = await readPlan('alder-finch', slug);
  if (plan === null) throw new Error(`no plan ${slug}`);
  return plan;
};
const stock = derive(await planOf('stock-reservation'));
const invoice = derive(await planOf('invoice-vat-number'));
const storefront = derive(await planOf('storefront-graph'));

const row = (rows: JourneyRow[], id: string): JourneyRow => {
  const found = rows.find((item) => item.id === id);
  if (found === undefined) throw new Error(`no row ${id}`);
  return found;
};
const NONE = { before: null, after: null };
const step = (id: string, action: string) => ({
  id: `flow:f#${id}`,
  action,
  from: 'svc:web',
  to: 'svc:subs',
  via: 'internal',
});

describe('journeyComparison: whole flows', () => {
  it.each([
    ['flow:abandon', 'added', 'asIs'],
    ['flow:oversell-report', 'removed', 'toBe'],
  ] as const)('%s is %s, with no fallback steps in the other graph', (id, presence, absent) => {
    const c = journeyComparison(stock, id);
    expect(c.presence).toBe(presence);
    expect(c.rows.length).toBeGreaterThan(0);
    expect(c.rows.every((r) => r.kind === presence)).toBe(true);
    const first = c.rows[0];
    if (first === undefined) throw new Error('no rows');
    const selected = journeyStep(stock, id, { stepId: first.id, mode: absent });
    expect(selected).toMatchObject({
      exists: false,
      flowExists: false,
      step: null,
      neighbours: NONE,
    });
    expect(first.changes.length).toBeGreaterThan(0);
  });

  it('says a missing flow is unknown, with nulls rather than undefined', () => {
    expect(journeyComparison(stock, 'flow:missing')).toEqual({
      id: 'flow:missing',
      beforeFlow: null,
      afterFlow: null,
      presence: 'unknown',
      rows: [],
    });
  });

  it('does not treat a flow whose every step is replaced as absent', async () => {
    const plan = await planOf('storefront-graph');
    const flow = plan.flows?.find((f) => f.id === 'flow:browse-product');
    if (flow === undefined) throw new Error('no flow');
    const first = flow.steps[0];
    if (first === undefined) throw new Error('no step');
    plan.changes = [
      {
        id: 'chg:replace',
        title: 'Replace the steps',
        ops: [
          { remove: first.id },
          ...flow.steps.slice(1).map((s) => ({ remove: s.id })),
          ...flow.steps.map((s, i) => ({
            add: 'step' as const,
            into: flow.id,
            value: { ...s, id: `${flow.id}#replacement-${String(i)}` },
          })),
        ],
      },
    ];
    const s = journeyStep(derive(plan), flow.id, { stepId: first.id, mode: 'toBe' });
    expect(s).toMatchObject({
      presence: 'existing',
      flowExists: true,
      exists: false,
      neighbours: NONE,
    });
    expect(s.comparison.afterFlow?.steps).toHaveLength(flow.steps.length);
  });
});

describe('journeyComparison: order', () => {
  it('keeps the actual gap of chained added steps in today', () => {
    const c = journeyComparison(stock, 'flow:reserve');
    const ids = c.rows.map((r) => r.id);
    const from = ids.indexOf('flow:reserve#hold') - 1;
    expect(ids.slice(from, ids.indexOf('flow:reserve#keep-ids') + 2)).toEqual([
      'flow:reserve#payment-step',
      'flow:reserve#hold',
      'flow:reserve#keep-ids',
      'flow:reserve#create',
    ]);
    for (const stepId of ['flow:reserve#hold', 'flow:reserve#keep-ids']) {
      const today = journeyStep(stock, c.id, { stepId });
      expect(today.flowExists).toBe(true);
      expect(today.exists).toBe(false);
      expect(today.neighbours).toEqual({
        before: 'flow:reserve#payment-step',
        after: 'flow:reserve#create',
      });
      expect(journeyStep(stock, c.id, { stepId, mode: 'toBe' }).step?.id).toBe(stepId);
    }
  });

  it('keeps removed runs beside baseline neighbours without disturbing the resulting order', async () => {
    const plan: Plan = await loadFixture('mini.yaml');
    plan.flows = [
      { id: 'flow:f', name: 'F', steps: ['a', 'b', 'c', 'd'].map((id) => step(id, id)) },
    ];
    plan.changes = [
      {
        id: 'chg:cut',
        title: 'Cut the middle',
        ops: [
          { remove: 'flow:f#b' },
          { remove: 'flow:f#c' },
          { add: 'step', into: 'flow:f', after: 'flow:f#a', value: step('new', 'New') },
        ],
      },
    ];
    const m = derive(plan);
    const c = journeyComparison(m, 'flow:f');
    expect(c.rows.filter((r) => r.after !== null).map((r) => r.id)).toEqual([
      'flow:f#a',
      'flow:f#new',
      'flow:f#d',
    ]);
    expect(c.rows.filter((r) => r.kind === 'removed').map((r) => r.id)).toEqual([
      'flow:f#b',
      'flow:f#c',
    ]);
    expect(journeyStep(m, 'flow:f', { stepId: 'flow:f#c', mode: 'toBe' }).neighbours).toEqual({
      before: 'flow:f#a',
      after: 'flow:f#d',
    });
  });

  it('reports a reordered step with its identity intact, and navigates by the selected graph', async () => {
    const plan = await planOf('invoice-vat-number');
    const flow = plan.flows?.find((f) => f.id === 'flow:issue-invoice');
    const render = flow?.steps.find((s) => s.id === 'flow:issue-invoice#render');
    if (render === undefined) throw new Error('no step');
    plan.changes = [
      {
        id: 'chg:reorder',
        title: 'Render later',
        ops: [
          { remove: render.id },
          {
            add: 'step',
            into: 'flow:issue-invoice',
            after: 'flow:issue-invoice#send',
            value: render,
          },
        ],
      },
    ];
    const m = derive(plan);
    const c = journeyComparison(m, 'flow:issue-invoice');
    const moved = row(c.rows, render.id);
    expect(moved.before).not.toBeNull();
    expect(moved.after).not.toBeNull();
    expect(moved.evidence.find((e) => e.kind === 'order')?.after).toBeGreaterThan(0);
  });
});

describe('journeyComparison: evidence', () => {
  it('keeps a deprecated step executable and names the change that deprecated it', () => {
    const c = journeyComparison(invoice, 'flow:issue-invoice');
    const r = row(c.rows, 'flow:issue-invoice#reissue');
    expect(r.kind).toBe('deprecated');
    expect(r.before).not.toBeNull();
    expect(r.after).not.toBeNull();
    expect(r.changes).toContain('chg:invoice-prints-vat');
    expect(journeyStep(invoice, c.id, { stepId: r.id, mode: 'toBe' }).exists).toBe(true);
  });

  it('keeps exact region layout apart from the context of the parent screen', () => {
    const r = row(
      journeyComparison(storefront, 'flow:browse-product').rows,
      'flow:browse-product#reviews',
    );
    expect(
      r.evidence.some(
        (e) => e.kind === 'screen-layout' && e.target === 'scr:pdp#reviews' && e.property === 'at',
      ),
    ).toBe(true);
    expect(
      r.evidence.some((e) => e.kind === 'screen-context' && e.target === 'scr:pdp' && e.indirect),
    ).toBe(true);
    expect(
      r.evidence.some((e) => e.target === 'scr:pdp#delivery' || e.target === 'scr:pdp#stock'),
    ).toBe(false);
    expect(r.evidence.some((e) => e.kind === 'step')).toBe(false);
  });

  it('treats a changed whole record as indirect evidence, not a behavioural change', async () => {
    const plan = await planOf('invoice-vat-number');
    plan.changes = [
      {
        id: 'chg:data-only',
        title: 'Add data',
        ops: [{ add: 'field', into: 'sch:order', value: { name: 'extra', type: 'string' } }],
      },
    ];
    const r = row(
      journeyComparison(derive(plan), 'flow:checkout-address').rows,
      'flow:checkout-address#publish',
    );
    expect(r.kind).toBe('same');
    expect(
      r.evidence.some((e) => e.kind === 'record' && e.target === 'sch:order' && e.indirect),
    ).toBe(true);
    expect(r.changes).toEqual(['chg:data-only']);
  });

  it('includes local old and new values without graph metadata noise', () => {
    const r = row(
      journeyComparison(invoice, 'flow:issue-invoice').rows,
      'flow:issue-invoice#render',
    );
    const logic = r.evidence.find((e) => e.kind === 'step' && e.property === 'logic');
    expect(String(logic?.before)).toMatch(/delivery address/);
    expect(String(logic?.after)).toMatch(/vat_country/);
    expect(
      r.evidence.some((e) => (e.property ?? '').startsWith('$') || e.property === 'sources'),
    ).toBe(false);
  });
});

describe('journeyStep', () => {
  it('keeps an unknown step unavailable rather than selecting the first', () => {
    const s = journeyStep(invoice, 'flow:issue-invoice', {
      stepId: 'flow:issue-invoice#missing',
      mode: 'toBe',
    });
    expect(s).toMatchObject({
      flowExists: true,
      exists: false,
      row: null,
      step: null,
      neighbours: NONE,
    });
  });

  it('follows the selected graph for neighbours', () => {
    const s = journeyStep(invoice, 'flow:issue-invoice', { stepId: 'flow:issue-invoice#render' });
    expect(s.exists).toBe(true);
    expect(s.neighbours).toEqual({
      before: 'flow:issue-invoice#consume',
      after: 'flow:issue-invoice#send',
    });
  });
});

export { type Model } from '@/application/plan/derive';
