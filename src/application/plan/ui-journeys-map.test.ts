import { describe, expect, it, vi } from 'vitest';

import { derive, type Model } from '@/application/plan/derive';
import { todayScreenMap } from '@/application/plan/ui-journeys-map';
import type {
  InteractionEdge,
  MapEdge,
  RecordedEdge,
} from '@/application/plan/ui-journeys-map-types';
import { todayWireflows } from '@/application/plan/ui-journeys-wireflow';
import type { Flow, Plan, Step } from '@/domain/plan/plan.generated';

vi.mock('server-only', () => ({}));

const { readPlan } = await import('@/infrastructure/plan-store');

interface Options {
  /** Keep the authored interactions and user journeys. */
  authored?: boolean;
  edit?: (plan: Plan) => void;
}

async function modelOf(slug: string, options: Options = {}): Promise<Model> {
  const { plan } = await readPlan('alder-finch', slug);
  if (plan === null) throw new Error(`no plan ${slug}`);
  if (options.authored !== true) {
    delete plan.interactions;
    delete plan.user_journeys;
  }
  options.edit?.(plan);
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
const recorded = (edge: MapEdge | undefined): RecordedEdge => {
  if (edge?.relationship !== 'recorded-order') throw new Error('not a recorded edge');
  return edge;
};
const interaction = (edge: MapEdge | undefined): InteractionEdge => {
  if (edge?.relationship !== 'interaction') throw new Error('not an interaction edge');
  return edge;
};
const SLUGS = ['invoice-vat-number', 'delivery-promise', 'storefront-graph', 'stock-reservation'];

describe('todayScreenMap: recorded order', () => {
  it.each(SLUGS)('gives every baseline screen of %s one identity across journeys', async (slug) => {
    const m = await modelOf(slug);
    const map = todayScreenMap(m);
    const wire = todayWireflows(m);
    expect(map.explicit).toBe(false);
    expect(map.nodes.map((n) => n.id)).toEqual(m.asIs.screens.map((s) => s.id));
    expect(map.unlinked).toEqual(wire.unlinked);
    expect(map.journeys.map((j) => j.id)).toEqual(wire.routes.map((r) => r.id));
    for (const node of map.nodes) {
      expect(node.screen).toBe(m.asIs.get(node.id));
      expect(node.journeyIds).toEqual(
        wire.routes.filter((r) => r.stops.some((s) => s.screen === node.id)).map((r) => r.id),
      );
      for (const record of node.records) {
        const step = m.asIs.get(record.stepId);
        expect(step?.$type === 'step' ? step.screen?.split('#')[0] : null).toBe(node.id);
      }
    }
  });

  it('lists a screen shared by journeys once, and an unlinked one with no journey', async () => {
    const map = todayScreenMap(await modelOf('delivery-promise'));
    expect(map.nodes.find((n) => n.id === 'scr:pdp')?.journeyIds).toEqual([
      'flow:browse-product',
      'flow:add-to-cart',
    ]);
    const loose = map.nodes.find((n) => map.unlinked.some((s) => s.id === n.id));
    expect(loose?.journeyIds).toEqual([]);
    expect(loose?.records).toEqual([]);
  });

  it('keeps edges as exact within-flow evidence, with authored labels and no claimed clicks', async () => {
    const m = await modelOf('delivery-promise');
    const map = todayScreenMap(m);
    const expected = todayWireflows(m).routes.flatMap((route) =>
      route.connectors.map((connector) => ({ route, connector })),
    );
    expect(map.edges).toHaveLength(expected.length);
    expect(new Set(map.edges.map((e) => e.id)).size).toBe(map.edges.length);
    for (const [i, edge] of map.edges.entries()) {
      const { route, connector } = expected[i] ?? {};
      expect(edge).toMatchObject({
        flowId: route?.id,
        actor: route?.actor,
        source: connector?.sourceScreen,
        destination: connector?.destinationScreen,
        sourceStepId: connector?.sourceStepId,
        destinationStepId: connector?.destinationStepId,
        kind: connector?.kind,
        relationship: 'recorded-order',
        steps: connector?.steps,
        notes: connector?.notes,
      });
    }
    const cart = recorded(map.edges.find((e) => e.flowId === 'flow:add-to-cart'));
    expect(cart).toMatchObject({
      label: 'Add the line',
      regionName: 'Add to cart',
      labelSource: 'authored-action',
    });
    const payment = recorded(map.edges.find((e) => e.sourceStepId === 'flow:checkout#delivery'));
    expect(payment.label).toBe('Show delivery');
    expect(payment.relationship).toBe('recorded-order');
  });

  it('distinguishes explicit initiating controls, unknown controls and recorded outputs', async () => {
    const m = await modelOf('delivery-promise');
    const { edges } = todayScreenMap(m);
    expect(edges.find((e) => e.flowId === 'flow:add-to-cart')).toMatchObject({
      label: 'Add the line',
      displayLabel: 'Add to cart',
      labelEvidence: 'explicit-trigger',
    });
    expect(edges.find((e) => e.sourceStepId === 'flow:checkout#delivery')).toMatchObject({
      label: 'Show delivery',
      displayLabel: 'Next screen',
      labelEvidence: 'recorded-order',
    });
    const email = edges.find((e) => e.destinationStepId === 'flow:checkout#confirmation');
    const step = m.asIs.get('flow:checkout#confirmation');
    expect(email).toMatchObject({
      displayLabel: step?.$type === 'step' ? step.action : '',
      labelEvidence: 'recorded-output',
    });
  });

  it.each([
    'The shopper reaches the product page.',
    'The shopper presses **Continue**.',
    'The shopper sees **Add to cart**.',
    'The shopper presses **Add to cart** and checks out.',
    'If the shopper presses **Add to cart**.',
    'The administrator presses **Add to cart**.',
    'The shopper presses **Add to cart later**.',
  ])('does not label a control from the trigger “%s”', async (trigger) => {
    const m = await modelOf('delivery-promise', {
      edit(plan) {
        flowOf(plan, 'flow:add-to-cart').trigger = trigger;
      },
    });
    const edge = todayScreenMap(m).edges.find((e) => e.flowId === 'flow:add-to-cart');
    expect(edge).toMatchObject({
      displayLabel: 'Next screen',
      labelEvidence: 'recorded-order',
      label: 'Add the line',
    });
  });

  it.each(['The shopper clicks the **Add to cart** button.', 'Shopper taps “Add to cart”.'])(
    'labels the control from the complete trigger “%s”',
    async (trigger) => {
      const m = await modelOf('delivery-promise', {
        edit(plan) {
          flowOf(plan, 'flow:add-to-cart').trigger = trigger;
        },
      });
      expect(todayScreenMap(m).edges.find((e) => e.flowId === 'flow:add-to-cart')).toMatchObject({
        displayLabel: 'Add to cart',
        labelEvidence: 'explicit-trigger',
      });
    },
  );

  it('does not label a later source or screen connection as a clicked control', async () => {
    const multi = await modelOf('delivery-promise', {
      edit(plan) {
        stepOf(flowOf(plan, 'flow:add-to-cart'), 1).screen = 'scr:pdp#add-to-cart';
      },
    });
    expect(todayScreenMap(multi).edges.find((e) => e.flowId === 'flow:add-to-cart')).toMatchObject({
      displayLabel: 'Next screen',
      labelEvidence: 'recorded-order',
    });
    const later = await modelOf('delivery-promise', {
      edit(plan) {
        const flow = flowOf(plan, 'flow:add-to-cart');
        stepOf(flow, 1).screen = 'scr:checkout-payment';
        stepOf(flow, 2).screen = 'scr:pdp#add-to-cart';
        flow.steps.push({
          ...stepOf(flow, 2),
          id: 'flow:add-to-cart#later-cart',
          screen: 'scr:cart#summary',
        });
      },
    });
    expect(
      todayScreenMap(later).edges.find((e) => e.sourceStepId === 'flow:add-to-cart#show'),
    ).toMatchObject({ displayLabel: 'Next screen', labelEvidence: 'recorded-order' });
  });

  it('groups journeys by actor without connecting adjacent tasks', async () => {
    const m = await modelOf('delivery-promise');
    const map = todayScreenMap(m);
    expect(map.groups.map((g) => g.actor)).toEqual([...new Set(map.journeys.map((j) => j.actor))]);
    for (const group of map.groups) {
      const journeys = map.journeys.filter((j) => j.actor === group.actor);
      expect(group.journeyIds).toEqual(journeys.map((j) => j.id));
      expect(group.nodeIds).toEqual([...new Set(journeys.flatMap((j) => j.nodeIds))]);
    }
    const wire = todayWireflows(m);
    for (const journey of map.journeys) {
      expect(journey.edgeIds).toEqual(
        map.edges.filter((e) => e.flowId === journey.id).map((e) => e.id),
      );
      expect(journey.nodeIds).toEqual(
        wire.routes.find((r) => r.id === journey.id)?.stops.map((s) => s.screen),
      );
    }
    expect(
      map.edges.some((e) => e.source === 'scr:cart' && e.destination === 'scr:checkout-delivery'),
    ).toBe(false);
  });

  it('keeps repeated visits as one node and same-screen actions without self-navigation', async () => {
    const repeated = await modelOf('invoice-vat-number', {
      edit(plan) {
        const flow = flowOf(plan, 'flow:checkout-address');
        stepOf(flow, 1).screen = 'scr:invoice-pdf';
        stepOf(flow, 2).screen = 'scr:checkout-address';
      },
    });
    const map = todayScreenMap(repeated);
    const [journey] = map.journeys;
    expect(map.nodes).toHaveLength(2);
    expect(journey?.nodeIds).toEqual([
      'scr:checkout-address',
      'scr:invoice-pdf',
      'scr:checkout-address',
    ]);
    expect(
      map.edges.filter((e) => e.flowId === journey?.id).map((e) => [e.source, e.destination]),
    ).toEqual([
      ['scr:checkout-address', 'scr:invoice-pdf'],
      ['scr:invoice-pdf', 'scr:checkout-address'],
    ]);
    const address = map.nodes.find((n) => n.id === 'scr:checkout-address');
    expect(address?.records.map((r) => [r.stepId, r.stopIndex, r.visitIndex])).toEqual([
      ['flow:checkout-address#form', 0, 0],
      ['flow:checkout-address#create', 2, 1],
    ]);
    const graph = todayScreenMap(await modelOf('storefront-graph'));
    expect(graph.edges.filter((e) => e.flowId === 'flow:browse-product')).toHaveLength(0);
    const pdp = graph.nodes.find((n) => n.id === 'scr:pdp');
    expect(
      pdp?.records.filter((r) => r.flowId === 'flow:browse-product').map((r) => r.stepId),
    ).toEqual([
      'flow:browse-product#open',
      'flow:browse-product#render',
      'flow:browse-product#reviews',
    ]);
    expect(graph.edges.every((e) => e.source !== e.destination)).toBe(true);
  });

  it('ignores proposal scenarios, screen pictures, names and newly linked steps', async () => {
    const original = todayScreenMap(await modelOf('invoice-vat-number'));
    const changed = await modelOf('invoice-vat-number', {
      edit(plan) {
        plan.problem.scenarios?.[0]?.flows?.reverse();
        plan.changes?.[0]?.ops.push(
          {
            modify: 'scr:checkout-address',
            set: { name: 'Future screen name', image: 'assets/future.svg' },
          },
          {
            add: 'step',
            into: 'flow:checkout-address',
            after: 'flow:checkout-address#form',
            value: {
              id: 'flow:checkout-address#new-navigation',
              action: 'Click future navigation',
              from: 'svc:storefront-web',
              to: 'svc:storefront-bff',
              via: 'api:bff-checkout-step',
              screen: 'scr:invoice-pdf',
            },
          },
        );
      },
    });
    expect(todayScreenMap(changed)).toEqual(original);
  });
});

describe('todayScreenMap: authored interactions', () => {
  it('draws navigation independently of backend flows, one node per screen', async () => {
    const m = await modelOf('delivery-promise', { authored: true });
    const map = todayScreenMap(m);
    expect(map.explicit).toBe(true);
    expect(map.nodes.map((n) => n.id)).toEqual(m.asIs.screens.map((s) => s.id));
    const has = (source: string, destination: string) =>
      map.edges.some((e) => e.source === source && e.destination === destination);
    expect(has('scr:cart', 'scr:checkout-delivery')).toBe(true);
    expect(has('scr:search-results', 'scr:pdp')).toBe(true);
    expect(has('scr:cart', 'scr:pdp')).toBe(true);
    const standalone = await modelOf('delivery-promise', {
      authored: true,
      edit(plan) {
        for (const i of plan.interactions ?? []) delete i.supporting_steps;
        for (const flow of plan.flows ?? []) for (const step of flow.steps) delete step.screen;
      },
    });
    const independent = todayScreenMap(standalone);
    const shape = (x: typeof map) => x.edges.map((e) => [e.source, e.destination, e.displayLabel]);
    expect(shape(independent)).toEqual(shape(map));
    expect(independent.edges.every((e) => e.steps.length === 0)).toBe(true);
    expect(independent.journeys).toHaveLength(2);
  });

  it('records each shared entrance once and keeps an ordered journey through a return', async () => {
    const m = await modelOf('delivery-promise', { authored: true });
    const map = todayScreenMap(m);
    const shared = map.edges.filter(
      (e) => e.relationship === 'interaction' && e.interactionId === 'ui:header-cart',
    );
    const authored = m.asIs.get('ui:header-cart');
    if (authored?.$type !== 'interaction') throw new Error('no interaction');
    expect(shared.map((e) => e.source)).toEqual(authored.from.map((id) => id.split('#')[0]));
    expect(
      shared.every(
        (e) => e.relationship === 'interaction' && e.shared && e.destination === 'scr:cart',
      ),
    ).toBe(true);
    expect(new Set(shared.map((e) => e.id)).size).toBe(shared.length);
    const returning = map.journeys.find(
      (j) => j.explicit && j.interactionIds.includes('ui:cart-product'),
    );
    expect(returning?.nodeIds).toEqual(['scr:cart', 'scr:pdp', 'scr:cart']);
    expect(map.nodes.filter((n) => n.id === 'scr:cart')).toHaveLength(1);
    for (const journey of map.journeys) {
      if (!journey.explicit) throw new Error('recorded journey');
      expect(
        journey.edgeIds.map((id) => interaction(map.edges.find((e) => e.id === id)).interactionId),
      ).toEqual(journey.interactionIds);
    }
  });

  it('retains conditions, results and exact supporting steps', async () => {
    const map = todayScreenMap(await modelOf('delivery-promise', { authored: true }));
    const output = interaction(
      map.edges.find(
        (e) => e.relationship === 'interaction' && e.interactionId === 'ui:place-order',
      ),
    );
    expect(output).toMatchObject({
      kind: 'output',
      condition: 'Payment succeeds and the order is created.',
      result: 'The shopper receives an order confirmation email.',
      sourceStepId: 'flow:checkout#pay',
      destinationStepId: 'flow:checkout#confirmation',
      flowId: 'flow:checkout',
    });
    expect(output.steps.map((s) => s.stepId)).toContain('flow:checkout#create');
    expect(
      map.edges.every((e) => e.relationship === 'interaction' && e.displayLabel === e.label),
    ).toBe(true);
  });

  it('keeps proposed navigation out of the current network', async () => {
    const original = todayScreenMap(await modelOf('delivery-promise', { authored: true }));
    const m = await modelOf('delivery-promise', {
      authored: true,
      edit(plan) {
        plan.changes?.[0]?.ops.push({
          modify: 'ui:search-product',
          set: { name: 'Future control', to: 'scr:cart' },
        });
        plan.problem.scenarios?.reverse();
      },
    });
    expect(todayScreenMap(m)).toEqual(original);
  });

  it('keeps a same-screen update as its explicit effect', async () => {
    const m = await modelOf('delivery-promise', {
      authored: true,
      edit(plan) {
        plan.interactions?.push({
          id: 'ui:update-product',
          name: 'Choose colour',
          from: ['scr:pdp'],
          to: 'scr:pdp',
          trigger: 'click',
          effect: 'update',
          result: 'The product picture changes.',
        });
      },
    });
    const edge = interaction(
      todayScreenMap(m).edges.find(
        (e) => e.relationship === 'interaction' && e.interactionId === 'ui:update-product',
      ),
    );
    expect(edge).toMatchObject({ source: 'scr:pdp', destination: 'scr:pdp', kind: 'update' });
  });

  it('gives a journey that begins at shared navigation every entrance, without inventing order', async () => {
    const m = await modelOf('delivery-promise', {
      authored: true,
      edit(plan) {
        plan.user_journeys?.push({
          id: 'uj:shared-cart',
          name: 'Visit the cart then the product',
          actor: 'Shopper',
          interactions: ['ui:header-cart', 'ui:cart-product'],
        });
      },
    });
    const journey = todayScreenMap(m).journeys.find((j) => j.id === 'uj:shared-cart');
    const sources = m.asIs.get('ui:header-cart');
    if (journey?.explicit !== true || sources?.$type !== 'interaction') throw new Error('missing');
    expect(journey.entranceIds).toEqual(sources.from);
    expect(sources.from.every((id) => journey.nodeIds.includes(id))).toBe(true);
    expect(journey.edgeIds).toHaveLength(sources.from.length + 1);
  });

  it('skips an interaction whose screens are not baseline screens', async () => {
    const m = await modelOf('delivery-promise', {
      authored: true,
      edit(plan) {
        plan.interactions?.push({
          id: 'ui:nowhere',
          name: 'Go nowhere',
          from: ['scr:pdp'],
          to: 'scr:missing',
          trigger: 'click',
          effect: 'navigate',
        });
      },
    });
    expect(todayScreenMap(m).edges.some((e) => e.id.startsWith('ui:nowhere'))).toBe(false);
  });
});
