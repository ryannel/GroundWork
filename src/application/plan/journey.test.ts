import { describe, expect, it, vi } from 'vitest';

import { quickCheckoutOnToday } from '@/../test/fixtures/acme/plans/core-checkout';
import { derive } from '@/application/plan/derive';
import { journeyComparison, journeyStep, type JourneyRow } from '@/application/plan/journey';
import type { Plan } from '@/domain/plan/plan.generated';

vi.mock(import('server-only'), () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');

/** The quick-checkout plan on the whole of the richer Acme today, which a test may change. */
const wholePlan = (): Plan => structuredClone(quickCheckoutOnToday().whole);
const checkout = derive(wholePlan());

const row = (rows: readonly JourneyRow[], id: string): JourneyRow => {
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
    ['flow:refund-order', 'added', 'asIs'],
    ['flow:cancel-order', 'removed', 'toBe'],
  ] as const)('%s is %s, with no fallback steps in the other graph', (id, presence, absent) => {
    const c = journeyComparison(checkout, id);
    expect(c.presence).toBe(presence);
    expect(c.rows.length).toBeGreaterThan(0);
    expect(c.rows.every((r) => r.kind === presence)).toBe(true);
    const first = c.rows[0];
    if (first === undefined) throw new Error('no rows');
    const selected = journeyStep(checkout, id, { stepId: first.id, mode: absent });
    expect(selected).toMatchObject({
      exists: false,
      flowExists: false,
      step: null,
      neighbours: NONE,
    });
    expect(first.changes.length).toBeGreaterThan(0);
  });

  it('says a missing flow is unknown, with nulls rather than undefined', () => {
    expect(journeyComparison(checkout, 'flow:missing')).toEqual({
      id: 'flow:missing',
      beforeFlow: null,
      afterFlow: null,
      presence: 'unknown',
      rows: [],
    });
  });

  it('does not treat a flow whose every step is replaced as absent', () => {
    const plan = wholePlan();
    const flow = plan.flows?.find((f) => f.id === 'flow:view-product');
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
    const c = journeyComparison(checkout, 'flow:add-to-basket');
    const ids = c.rows.map((r) => r.id);
    const from = ids.indexOf('flow:add-to-basket#reserve') - 1;
    expect(ids.slice(from, ids.indexOf('flow:add-to-basket#hold') + 2)).toEqual([
      'flow:add-to-basket#price',
      'flow:add-to-basket#reserve',
      'flow:add-to-basket#hold',
      'flow:add-to-basket#show',
    ]);
    for (const stepId of ['flow:add-to-basket#reserve', 'flow:add-to-basket#hold']) {
      const today = journeyStep(checkout, c.id, { stepId });
      expect(today.flowExists).toBe(true);
      expect(today.exists).toBe(false);
      expect(today.neighbours).toEqual({
        before: 'flow:add-to-basket#price',
        after: 'flow:add-to-basket#show',
      });
      expect(journeyStep(checkout, c.id, { stepId, mode: 'toBe' }).step?.id).toBe(stepId);
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

  it('reports a reordered step with its identity intact, and navigates by the selected graph', () => {
    const plan = wholePlan();
    const flow = plan.flows?.find((f) => f.id === 'flow:place-order');
    const card = flow?.steps.find((s) => s.id === 'flow:place-order#card');
    if (card === undefined) throw new Error('no step');
    plan.changes = [
      {
        id: 'chg:reorder',
        title: 'Charge the card later',
        ops: [
          { remove: card.id },
          {
            add: 'step',
            into: 'flow:place-order',
            after: 'flow:place-order#publish',
            value: card,
          },
        ],
      },
    ];
    const m = derive(plan);
    const c = journeyComparison(m, 'flow:place-order');
    const moved = row(c.rows, card.id);
    expect(moved.before).not.toBeNull();
    expect(moved.after).not.toBeNull();
    expect(moved.evidence.find((e) => e.kind === 'order')?.after).toBeGreaterThan(0);
    expect(journeyStep(m, c.id, { stepId: card.id, mode: 'toBe' }).neighbours).toEqual({
      before: 'flow:place-order#publish',
      after: 'flow:place-order#email',
    });
  });
});

describe('journeyComparison: evidence', () => {
  it('keeps a deprecated step executable and names the change that deprecated it', () => {
    const c = journeyComparison(checkout, 'flow:publish-product');
    const r = row(c.rows, 'flow:publish-product#refresh');
    expect(r.kind).toBe('deprecated');
    expect(r.before).not.toBeNull();
    expect(r.after).not.toBeNull();
    expect(r.changes).toContain('chg:product-v2');
    expect(journeyStep(checkout, c.id, { stepId: r.id, mode: 'toBe' }).exists).toBe(true);
  });

  it('keeps exact region layout apart from the context of the parent screen', () => {
    const r = row(journeyComparison(checkout, 'flow:place-order').rows, 'flow:place-order#submit');
    expect(
      r.evidence.some(
        (e) => e.kind === 'screen-layout' && e.target === 'scr:basket#pay' && e.property === 'at',
      ),
    ).toBe(true);
    expect(
      r.evidence.some(
        (e) => e.kind === 'screen-context' && e.target === 'scr:basket' && e.indirect,
      ),
    ).toBe(true);
    expect(r.evidence.some((e) => e.target === 'scr:basket#lines')).toBe(false);
    expect(r.evidence.some((e) => e.kind === 'step')).toBe(false);
  });

  it('treats a changed whole record as indirect evidence, not a behavioural change', () => {
    const plan = wholePlan();
    plan.changes = [
      {
        id: 'chg:data-only',
        title: 'Add data',
        ops: [{ add: 'field', into: 'sch:order', value: { name: 'extra', type: 'string' } }],
      },
    ];
    const r = row(
      journeyComparison(derive(plan), 'flow:place-order').rows,
      'flow:place-order#create',
    );
    expect(r.kind).toBe('same');
    expect(
      r.evidence.some((e) => e.kind === 'record' && e.target === 'sch:order' && e.indirect),
    ).toBe(true);
    expect(r.changes).toEqual(['chg:data-only']);
  });

  it('includes local old and new values without graph metadata noise', () => {
    const r = row(journeyComparison(checkout, 'flow:place-order').rows, 'flow:place-order#card');
    const logic = r.evidence.find((e) => e.kind === 'step' && e.property === 'logic');
    expect(String(logic?.before)).toMatch(/pays by card\.$/u);
    expect(String(logic?.after)).toMatch(/card or wallet/u);
    expect(
      r.evidence.some((e) => (e.property ?? '').startsWith('$') || e.property === 'sources'),
    ).toBe(false);
  });
});

describe('journeyStep', () => {
  it('keeps an unknown step unavailable rather than selecting the first', () => {
    const s = journeyStep(checkout, 'flow:place-order', {
      stepId: 'flow:place-order#missing',
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
    const s = journeyStep(checkout, 'flow:place-order', { stepId: 'flow:place-order#card' });
    expect(s.exists).toBe(true);
    expect(s.neighbours).toEqual({
      before: 'flow:place-order#charge',
      after: 'flow:place-order#publish',
    });
    expect(
      journeyStep(checkout, 'flow:publish-product', {
        stepId: 'flow:publish-product#announce',
        mode: 'toBe',
      }).neighbours,
    ).toEqual({ before: 'flow:publish-product#save', after: 'flow:publish-product#index' });
  });
});

export { type Model } from '@/application/plan/derive';
