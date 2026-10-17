import { describe, expect, it } from 'vitest';

import { quickCheckoutOnToday } from '@/../test/fixtures/acme/plans/core-checkout';
import { giftWrap } from '@/../test/fixtures/acme/plans/journeys-gift-wrap';
import { pauseOrders } from '@/../test/fixtures/acme/plans/pause-orders';
import { coreShop } from '@/../test/fixtures/core-shop';
import { derive, type Model } from '@/application/plan/derive';
import { todayJourneys } from '@/application/plan/ui-journeys';
import { todayScreenCatalogue } from '@/application/plan/ui-journeys-map';
import { todayWireflows } from '@/application/plan/ui-journeys-wireflow';
import type { Flow, Plan, Step } from '@/domain/plan/plan.generated';

const PLANS: readonly (readonly [string, () => Plan])[] = [
  ['quick-checkout', () => quickCheckoutOnToday().whole],
  ['gift-wrap', giftWrap],
  ['pause-orders', pauseOrders],
  ['shop', coreShop],
];

/** A model of a plan without its authored navigation, so the recorded order is what shows. */
function recorded(plan: Plan, edit?: (plan: Plan) => void): Model {
  const copy = structuredClone(plan);
  delete copy.interactions;
  delete copy.user_journeys;
  edit?.(copy);
  return derive(copy);
}
/** Quick checkout on the richer Acme today, with the whole of today in it. */
const checkout = (edit?: (plan: Plan) => void): Model =>
  recorded(quickCheckoutOnToday().whole, edit);
/** The shop with its screens and every step's screen taken out. */
function unseen(): Model {
  const plan = coreShop();
  delete plan.screens;
  for (const flow of plan.flows ?? []) for (const step of flow.steps) delete step.screen;
  return recorded(plan);
}
const ROUTES = ['flow:view-product', 'flow:add-to-basket', 'flow:place-order'];

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
const routeOf = <R extends { readonly id: string }>(routes: readonly R[], id: string): R => {
  const route = routes.find((r) => r.id === id);
  if (route === undefined) throw new Error(`no route ${id}`);
  return route;
};

describe('todayJourneys', () => {
  it('keeps viewing, adding and ordering apart, with each flow’s background work intact', () => {
    const { routes, unlinked } = todayJourneys(checkout());
    expect(routes.map((r) => r.id)).toEqual(ROUTES);
    expect(routes.map((r) => r.stops.map((s) => s.screen))).toEqual([
      ['scr:product-page'],
      ['scr:product-page', 'scr:basket'],
      ['scr:basket', 'scr:order-email', 'scr:confirmation'],
    ]);
    const [view, add, order] = routes;
    expect(view?.stops[0]?.during.map((e) => e.step.action)).toEqual([
      'Load the product',
      'Show the stock',
    ]);
    expect(add?.stops[0]?.after.map((e) => e.step.action)).toEqual(['Price the line']);
    expect(order?.stops[0]?.after.map((e) => e.step.action)).toEqual([
      'Create the order',
      'Take payment',
      'Charge the card',
      'Announce the order',
    ]);
    expect(order?.stops[1]?.before).toEqual([]);
    expect(unlinked.map((s) => s.id)).toEqual(['scr:search-results']);
  });

  it('numbers stops across routes with an offset', () => {
    const j = todayJourneys(checkout());
    expect(j.routes.map((r) => r.offset)).toEqual([0, 1, 3]);
    let expected = 0;
    for (const route of j.routes) {
      expect(route.offset).toBe(expected);
      expected += route.stops.length;
    }
    expect(j.stops).toHaveLength(expected);
  });

  it('is not changed by proposal scenarios', () => {
    const expected = pathsOf(checkout());
    for (const flows of [
      [],
      ['flow:place-order', 'flow:view-product'],
      ['flow:add-to-basket', 'flow:refund-order', 'flow:place-order'],
    ]) {
      const m = checkout((plan) => {
        const scenario = plan.problem.scenarios?.[0];
        if (scenario !== undefined) scenario.flows = flows;
      });
      expect(pathsOf(m)).toEqual(expected);
    }
  });

  it('does not turn background work into a second stop on the same visible screen', () => {
    const m = checkout((plan) => {
      stepOf(flowOf(plan, 'flow:place-order'), 1).screen = 'scr:basket';
    });
    const route = routeOf(todayJourneys(m).routes, 'flow:place-order');
    expect(route.stops).toHaveLength(3);
    expect(route.stops[0]?.during[0]?.step.action).toBe('Create the order');
    expect(route.stops[0]?.actions).toHaveLength(2);
  });

  it('keeps a revisit as its own stop', () => {
    const m = checkout((plan) => {
      const flow = flowOf(plan, 'flow:add-to-basket');
      stepOf(flow, 1).screen = 'scr:basket';
      stepOf(flow, 2).screen = 'scr:product-page';
    });
    const route = routeOf(todayJourneys(m).routes, 'flow:add-to-basket');
    expect(route.stops.map((s) => s.screen)).toEqual([
      'scr:product-page',
      'scr:basket',
      'scr:product-page',
    ]);
    expect(route.stops[1]?.actions[0]?.action).toBe('Price the line');
  });

  it('keeps a screen with no recorded step visible, without a journey position', () => {
    const m = checkout((plan) => {
      plan.problem.scenarios?.splice(0);
      delete stepOf(flowOf(plan, 'flow:place-order'), 5).screen;
    });
    const c = todayScreenCatalogue(m);
    expect(c.routes).toHaveLength(3);
    expect(routeOf(c.routes, 'flow:place-order').stops.map((s) => s.screen)).toEqual([
      'scr:basket',
      'scr:confirmation',
    ]);
    expect(c.unlinked.map((s) => s.id)).toEqual(['scr:order-email', 'scr:search-results']);
  });

  it('keeps a proposed screen link out of today', () => {
    const m = checkout((plan) => {
      delete stepOf(flowOf(plan, 'flow:place-order'), 5).screen;
      delete stepOf(flowOf(plan, 'flow:view-product'), 0).screen;
      delete stepOf(flowOf(plan, 'flow:view-product'), 2).screen;
      plan.changes?.[0]?.ops.push({
        modify: 'flow:place-order#email',
        set: { screen: 'scr:order-email' },
      });
    });
    expect(m.toBe.get('flow:place-order#email')).toMatchObject({ screen: 'scr:order-email' });
    const c = todayScreenCatalogue(m);
    expect(c.routes.map((r) => r.id)).toEqual(['flow:add-to-basket', 'flow:place-order']);
    expect(c.unlinked.map((s) => s.id)).toEqual(['scr:order-email', 'scr:search-results']);
  });
});

describe('todayScreenCatalogue', () => {
  it.each(PLANS)(
    'groups every baseline screen of %s by serving app, keeping order',
    (_name, plan) => {
      const m = recorded(plan());
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

  it('leaves out the new refund email', () => {
    const m = checkout();
    expect(todayScreenCatalogue(m).screens).toHaveLength(5);
    expect(m.toBe.screens).toHaveLength(6);
    expect(todayScreenCatalogue(m).screens.map((s) => s.id)).not.toContain('scr:refund-email');
    expect(todayScreenCatalogue(m).groups.map((g) => g.service)).toEqual([
      'svc:order-mailer',
      'svc:shop-web',
    ]);
    expect(todayScreenCatalogue(m).routes.filter((r) => r.id === 'flow:place-order')).toHaveLength(
      1,
    );
  });

  it('is empty for a plan without recorded screens', () => {
    expect(todayScreenCatalogue(unseen())).toEqual({
      routes: [],
      screens: [],
      groups: [],
      unlinked: [],
    });
  });
});

describe('todayWireflows', () => {
  it('keeps every screen-linked step selectable, including same-screen updates', () => {
    const browse = routeOf(todayWireflows(checkout()).routes, 'flow:view-product');
    const stop = browse.stops[0];
    expect(browse.stops).toHaveLength(1);
    expect(stop?.records.map((r) => r.stepId)).toEqual([
      'flow:view-product#open',
      'flow:view-product#stock',
    ]);
    expect(stop?.records[1]).toMatchObject({
      region: 'scr:product-page#stock',
      experienceKind: 'update',
      classificationInferred: true,
    });
    expect(browse.connectors).toEqual([]);
    expect(stop?.connector).toBeNull();
  });

  it('expresses exact recorded boundaries and keeps intervening prose', () => {
    const m = checkout();
    const wire = todayWireflows(m);
    const [basket] = routeOf(wire.routes, 'flow:add-to-basket').connectors;
    expect(basket).toMatchObject({
      kind: 'recorded-order',
      label: 'Next recorded screen',
      sourceStepId: 'flow:add-to-basket#add',
      destinationStepId: 'flow:add-to-basket#show',
      sourceScreen: 'scr:product-page',
      destinationScreen: 'scr:basket',
    });
    expect(basket?.steps.map((s) => s.stepId)).toEqual([
      'flow:add-to-basket#add',
      'flow:add-to-basket#price',
      'flow:add-to-basket#show',
    ]);
    expect(basket?.notes).toEqual([]);
    const [email, confirmation] = routeOf(wire.routes, 'flow:place-order').connectors;
    expect(email).toMatchObject({
      kind: 'output',
      label: 'Recorded output',
      sourceStepId: 'flow:place-order#submit',
      destinationStepId: 'flow:place-order#email',
      sourceScreen: 'scr:basket',
      destinationScreen: 'scr:order-email',
    });
    expect(email?.steps).toHaveLength(6);
    const charge = m.asIs.get('flow:place-order#charge');
    const card = m.asIs.get('flow:place-order#card');
    if (charge?.$type !== 'step' || card?.$type !== 'step') throw new Error('no step');
    expect(email?.notes).toContainEqual({ stepId: card.id, type: 'logic', text: card.logic });
    expect(email?.notes).toContainEqual({ stepId: charge.id, type: 'fails', text: charge.fails });
    expect(email?.notes.map((n) => n.text)).toContain('Only when the customer pays by card.');
    expect(confirmation).toMatchObject({
      kind: 'recorded-order',
      sourceStepId: 'flow:place-order#email',
      destinationStepId: 'flow:place-order#show',
    });
  });

  it('is baseline-only and does not turn inferred UI actions into proven controls', () => {
    const m = checkout((plan) => {
      plan.changes?.[0]?.ops.push({
        add: 'step',
        into: 'flow:add-to-basket',
        after: 'flow:add-to-basket#add',
        value: {
          id: 'flow:add-to-basket#future-ui',
          from: 'svc:shop-web',
          to: 'svc:shop-bff',
          via: 'api:bff-add-line',
          action: 'Click the new gift control',
          screen: 'scr:product-page#buy',
        },
      });
    });
    expect(m.toBe.has('flow:add-to-basket#future-ui')).toBe(true);
    const wire = todayWireflows(m);
    expect(wire.routes.map((r) => r.id)).toEqual(ROUTES);
    const add = routeOf(wire.routes, 'flow:add-to-basket');
    expect(add.stops[0]?.records).toHaveLength(1);
    expect(add.stops[0]?.records[0]).toMatchObject({
      stepId: 'flow:add-to-basket#add',
      experienceKind: 'action',
      classificationInferred: true,
      action: 'Add the line',
      logic: null,
    });
    expect(JSON.stringify(wire)).not.toContain('future-ui');
    expect(routeOf(wire.routes, 'flow:view-product').connectors).toEqual([]);
    const order = routeOf(wire.routes, 'flow:place-order');
    expect(order.stops[1]?.records[0]?.experienceKind).toBe('output');
    expect(order.stops[1]?.records[0]?.classificationInferred).toBe(false);
  });

  it('keeps repeated visits and unlinked screens', () => {
    const m = checkout((plan) => {
      const flow = flowOf(plan, 'flow:add-to-basket');
      stepOf(flow, 1).screen = 'scr:order-email';
      stepOf(flow, 2).screen = 'scr:product-page';
      delete stepOf(flowOf(plan, 'flow:place-order'), 6).screen;
      plan.screens?.push({
        id: 'scr:loose',
        name: 'Loose screen',
        service: 'svc:shop-web',
        kind: 'page',
      });
    });
    const wire = todayWireflows(m);
    const route = routeOf(wire.routes, 'flow:add-to-basket');
    expect(route.stops.map((s) => s.screen)).toEqual([
      'scr:product-page',
      'scr:order-email',
      'scr:product-page',
    ]);
    expect(route.stops.map((s) => s.records[0]?.stepId)).toEqual([
      'flow:add-to-basket#add',
      'flow:add-to-basket#price',
      'flow:add-to-basket#show',
    ]);
    expect(route.connectors.map((c) => c.kind)).toEqual(['output', 'recorded-order']);
    expect(wire.unlinked.map((s) => s.id)).toEqual([
      'scr:confirmation',
      'scr:search-results',
      'scr:loose',
    ]);
  });

  it('is empty for a plan without recorded screens', () => {
    expect(todayWireflows(unseen())).toEqual({
      routes: [],
      unlinked: [],
      stops: [],
    });
  });
});
