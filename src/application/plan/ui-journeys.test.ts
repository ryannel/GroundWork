import { describe, expect, it, vi } from 'vitest';

import { derive, type Model } from '@/application/plan/derive';
import { todayJourneys } from '@/application/plan/ui-journeys';
import { todayScreenCatalogue } from '@/application/plan/ui-journeys-map';
import { todayWireflows } from '@/application/plan/ui-journeys-wireflow';
import type { Flow, Plan, Step } from '@/domain/plan/plan.generated';

vi.mock('server-only', () => ({}));

const { readPlan } = await import('@/infrastructure/plan-store');

const SLUGS = ['invoice-vat-number', 'delivery-promise', 'storefront-graph', 'stock-reservation'];

/** A model of an alder-finch plan without its authored navigation, so the recorded order is what shows. */
async function modelOf(slug: string, edit?: (plan: Plan) => void): Promise<Model> {
  const { plan } = await readPlan('alder-finch', slug);
  if (plan === null) throw new Error(`no plan ${slug}`);
  delete plan.interactions;
  delete plan.user_journeys;
  edit?.(plan);
  return derive(plan);
}

const flowOf = (plan: Plan, id: string): Flow => {
  const flow = plan.flows?.find((f) => f.id === id);
  if (flow === undefined) throw new Error(`no flow ${id}`);
  return flow;
};
const stepOf = (flow: Flow, i: number): Step => {
  const step = flow.steps[i];
  if (step === undefined) throw new Error(`no step ${String(i)}`);
  return step;
};
const pathsOf = (m: Model) =>
  todayJourneys(m).routes.map((r) => [r.id, r.stops.map((s) => s.screen)]);

describe('todayJourneys', () => {
  it('keeps checkout and invoicing apart, with each flow’s background work intact', async () => {
    const { routes, unlinked } = todayJourneys(await modelOf('invoice-vat-number'));
    expect(routes.map((r) => r.id)).toEqual(['flow:checkout-address', 'flow:issue-invoice']);
    expect(routes.map((r) => r.stops.map((s) => s.screen))).toEqual([
      ['scr:checkout-address'],
      ['scr:invoice-pdf'],
    ]);
    const [checkout, invoicing] = routes;
    expect(checkout?.stops[0]?.after.map((e) => e.step.action)).toEqual([
      'Store the address',
      'Create the order',
      'Announce the order',
    ]);
    expect(invoicing?.stops[0]?.before[0]?.step.action).toBe('Take the order');
    expect(invoicing?.stops[0]?.after.at(-1)?.step.action).toMatch(/Re-issue by hand/);
    expect(unlinked).toEqual([]);
  });

  it('numbers stops across routes with an offset', async () => {
    const j = todayJourneys(await modelOf('delivery-promise'));
    let expected = 0;
    for (const route of j.routes) {
      expect(route.offset).toBe(expected);
      expected += route.stops.length;
    }
    expect(j.stops).toHaveLength(expected);
  });

  it('is not changed by proposal scenarios', async () => {
    const expected = pathsOf(await modelOf('invoice-vat-number'));
    for (const flows of [
      [],
      ['flow:issue-invoice', 'flow:checkout-address'],
      ['flow:checkout-address', 'flow:future', 'flow:issue-invoice'],
    ]) {
      const m = await modelOf('invoice-vat-number', (plan) => {
        const scenario = plan.problem.scenarios?.[0];
        if (scenario !== undefined) scenario.flows = flows;
      });
      expect(pathsOf(m)).toEqual(expected);
    }
  });

  it('does not turn background work into a second stop on the same visible screen', async () => {
    const m = await modelOf('invoice-vat-number', (plan) => {
      stepOf(flowOf(plan, 'flow:checkout-address'), 2).screen = 'scr:checkout-address';
    });
    const [route] = todayJourneys(m).routes;
    expect(route?.stops).toHaveLength(1);
    expect(route?.stops[0]?.during[0]?.step.action).toBe('Store the address');
    expect(route?.stops[0]?.actions).toHaveLength(2);
  });

  it('keeps a revisit as its own stop', async () => {
    const m = await modelOf('invoice-vat-number', (plan) => {
      const flow = flowOf(plan, 'flow:checkout-address');
      stepOf(flow, 1).screen = 'scr:invoice-pdf';
      stepOf(flow, 2).screen = 'scr:checkout-address';
    });
    const [route] = todayJourneys(m).routes;
    expect(route?.stops.map((s) => s.screen)).toEqual([
      'scr:checkout-address',
      'scr:invoice-pdf',
      'scr:checkout-address',
    ]);
    expect(route?.stops[1]?.actions[0]?.action).toBe('Store the address');
  });

  it('keeps a screen with no recorded step visible, without a journey position', async () => {
    const m = await modelOf('invoice-vat-number', (plan) => {
      plan.problem.scenarios?.splice(0);
      delete stepOf(flowOf(plan, 'flow:issue-invoice'), 1).screen;
    });
    const c = todayScreenCatalogue(m);
    expect(c.routes).toHaveLength(1);
    expect(c.routes[0]?.stops).toHaveLength(1);
    expect(c.unlinked[0]?.id).toBe('scr:invoice-pdf');
  });

  it('keeps a proposed screen link out of today', async () => {
    const m = await modelOf('invoice-vat-number', (plan) => {
      delete stepOf(flowOf(plan, 'flow:issue-invoice'), 1).screen;
      plan.changes?.[0]?.ops.push({
        modify: 'flow:issue-invoice#render',
        set: { screen: 'scr:invoice-pdf' },
      });
    });
    const c = todayScreenCatalogue(m);
    expect(c.routes.map((r) => r.id)).toEqual(['flow:checkout-address']);
    expect(c.unlinked.map((s) => s.id)).toEqual(['scr:invoice-pdf']);
  });
});

describe('todayScreenCatalogue', () => {
  it.each(SLUGS)(
    'groups every baseline screen of %s by serving app, keeping order',
    async (slug) => {
      const m = await modelOf(slug);
      const c = todayScreenCatalogue(m);
      expect(c.screens).toEqual(m.asIs.screens);
      expect(c.groups.flatMap((g) => g.screens)).toHaveLength(c.screens.length);
      expect(c.groups.map((g) => g.service)).toEqual([...new Set(c.screens.map((s) => s.service))]);
      for (const g of c.groups) {
        expect(g.screens).toEqual(c.screens.filter((s) => s.service === g.service));
      }
      expect(new Set(c.routes.map((r) => r.id)).size).toBe(c.routes.length);
      for (const r of c.routes) {
        expect(r.flowIds).toEqual([r.flow.id]);
        expect(r.actor).toBe(r.flow.actor);
        expect(r.trigger).toBe(r.flow.trigger);
        expect(r.outcome).toBe(r.flow.outcome);
      }
    },
  );

  it('leaves out the two new notification screens in Delivery', async () => {
    const m = await modelOf('delivery-promise');
    expect(todayScreenCatalogue(m).screens).toHaveLength(9);
    expect(m.toBe.screens).toHaveLength(11);
    expect(todayScreenCatalogue(m).routes.filter((r) => r.id === 'flow:checkout')).toHaveLength(1);
  });

  it('is empty for a plan without recorded screens', async () => {
    expect(todayScreenCatalogue(await modelOf('stock-reservation'))).toEqual({
      routes: [],
      screens: [],
      groups: [],
      unlinked: [],
    });
  });
});

describe('todayWireflows', () => {
  it('keeps every screen-linked step selectable, including same-screen updates', async () => {
    const m = await modelOf('storefront-graph');
    const browse = todayWireflows(m).routes.find((r) => r.id === 'flow:browse-product');
    const stop = browse?.stops[0];
    expect(browse?.stops).toHaveLength(1);
    expect(stop?.records.map((r) => r.stepId)).toEqual([
      'flow:browse-product#open',
      'flow:browse-product#render',
      'flow:browse-product#reviews',
    ]);
    expect(stop?.records[1]).toMatchObject({
      region: 'scr:pdp#stock',
      experienceKind: 'update',
      classificationInferred: true,
    });
    expect(browse?.connectors).toEqual([]);
    expect(stop?.connector).toBeNull();
  });

  it('expresses exact recorded boundaries and keeps intervening prose', async () => {
    const m = await modelOf('delivery-promise');
    const checkout = todayWireflows(m).routes.find((r) => r.id === 'flow:checkout');
    const [payment, email] = checkout?.connectors ?? [];
    expect(payment).toMatchObject({
      kind: 'recorded-order',
      label: 'Next recorded screen',
      sourceStepId: 'flow:checkout#delivery',
      destinationStepId: 'flow:checkout#pay',
      sourceScreen: 'scr:checkout-delivery',
      destinationScreen: 'scr:checkout-payment',
    });
    expect(payment?.steps.map((s) => s.stepId)).toEqual([
      'flow:checkout#delivery',
      'flow:checkout#quote',
      'flow:checkout#partner-quote',
      'flow:checkout#pay',
    ]);
    const quote = m.asIs.get('flow:checkout#quote');
    if (quote?.$type !== 'step') throw new Error('no step');
    expect(payment?.notes).toContainEqual({
      stepId: quote.id,
      type: 'logic',
      text: quote.logic,
    });
    expect(payment?.notes).toContainEqual({ stepId: quote.id, type: 'fails', text: quote.fails });
    expect(email).toMatchObject({
      kind: 'output',
      label: 'Recorded output',
      sourceStepId: 'flow:checkout#pay',
      destinationStepId: 'flow:checkout#confirmation',
    });
    expect(email?.notes.map((n) => n.text)).toContain('Only when the shopper chose financing.');
  });

  it('is baseline-only and does not turn inferred UI actions into proven controls', async () => {
    const m = await modelOf('invoice-vat-number', (plan) => {
      plan.changes?.[0]?.ops.push({
        add: 'step',
        into: 'flow:checkout-address',
        after: 'flow:checkout-address#form',
        value: {
          id: 'flow:checkout-address#future-ui',
          from: 'svc:storefront-web',
          to: 'svc:storefront-bff',
          via: 'api:bff-checkout-step',
          action: 'Click the new business control',
          screen: 'scr:checkout-address#address',
        },
      });
    });
    const wire = todayWireflows(m);
    expect(wire.routes.map((r) => r.id)).toEqual(['flow:checkout-address', 'flow:issue-invoice']);
    const record = wire.routes[0]?.stops[0]?.records[0];
    expect(record).toMatchObject({
      stepId: 'flow:checkout-address#form',
      experienceKind: 'action',
      classificationInferred: true,
      action: 'Submit the address',
      logic: null,
    });
    expect(JSON.stringify(wire)).not.toContain('future-ui');
    expect(wire.routes[0]?.connectors).toEqual([]);
    expect(wire.routes[1]?.stops[0]?.records[0]?.experienceKind).toBe('output');
  });

  it('keeps repeated visits and unlinked screens', async () => {
    const m = await modelOf('invoice-vat-number', (plan) => {
      const flow = flowOf(plan, 'flow:checkout-address');
      stepOf(flow, 1).screen = 'scr:invoice-pdf';
      stepOf(flow, 2).screen = 'scr:checkout-address';
      delete stepOf(flowOf(plan, 'flow:issue-invoice'), 1).screen;
      plan.screens?.push({
        id: 'scr:loose',
        name: 'Loose screen',
        service: 'svc:storefront-web',
        kind: 'page',
      });
    });
    const wire = todayWireflows(m);
    const route = wire.routes[0];
    expect(route?.stops.map((s) => s.screen)).toEqual([
      'scr:checkout-address',
      'scr:invoice-pdf',
      'scr:checkout-address',
    ]);
    expect(route?.stops.map((s) => s.records[0]?.stepId)).toEqual([
      'flow:checkout-address#form',
      'flow:checkout-address#store',
      'flow:checkout-address#create',
    ]);
    expect(route?.connectors.map((c) => c.kind)).toEqual(['output', 'recorded-order']);
    expect(wire.unlinked.map((s) => s.id)).toEqual(['scr:loose']);
  });

  it('is empty for a plan without recorded screens', async () => {
    expect(todayWireflows(await modelOf('stock-reservation'))).toEqual({
      routes: [],
      unlinked: [],
      stops: [],
    });
  });
});
