import { describe, expect, it } from 'vitest';

import { quickCheckoutOnToday } from '@/../test/fixtures/acme/plans/core-checkout';
import { giftWrap } from '@/../test/fixtures/acme/plans/journeys-gift-wrap';
import { pauseOrders } from '@/../test/fixtures/acme/plans/pause-orders';
import { coreShop } from '@/../test/fixtures/core-shop';
import { derive, type Model } from '@/application/plan/derive';
import { todayScreenMap } from '@/application/plan/ui-journeys-map';
import type {
  InteractionEdge,
  MapEdge,
  RecordedEdge,
} from '@/application/plan/ui-journeys-map-types';
import { todayWireflows } from '@/application/plan/ui-journeys-wireflow';
import type { Flow, Plan, Step } from '@/domain/plan/plan.generated';

interface Options {
  /** Keep the authored interactions and user journeys. */
  authored?: boolean;
  edit?: (plan: Plan) => void;
}

function modelFrom(whole: Plan, options: Options = {}): Model {
  const plan = structuredClone(whole);
  if (options.authored !== true) {
    delete plan.interactions;
    delete plan.user_journeys;
  }
  options.edit?.(plan);
  return derive(plan);
}
/** Quick checkout on the richer Acme today, with the whole of today in it. */
const checkout = (options: Options = {}): Model => modelFrom(quickCheckoutOnToday().whole, options);

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
const PLANS: readonly (readonly [string, () => Plan])[] = [
  ['quick-checkout', () => quickCheckoutOnToday().whole],
  ['gift-wrap', giftWrap],
  ['pause-orders', pauseOrders],
  ['shop', coreShop],
];

describe('todayScreenMap: recorded order', () => {
  it.each(PLANS)(
    'gives every baseline screen of %s one identity across journeys',
    (_name, plan) => {
      const m = modelFrom(plan());
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
    },
  );

  it('lists a screen shared by journeys once, and an unlinked one with no journey', () => {
    const map = todayScreenMap(checkout());
    expect(map.nodes.filter((n) => n.id === 'scr:product-page')).toHaveLength(1);
    expect(map.nodes.find((n) => n.id === 'scr:product-page')?.journeyIds).toEqual([
      'flow:view-product',
      'flow:add-to-basket',
    ]);
    expect(map.unlinked.map((s) => s.id)).toEqual(['scr:search-results']);
    const loose = map.nodes.find((n) => map.unlinked.some((s) => s.id === n.id));
    expect(loose?.id).toBe('scr:search-results');
    expect(loose?.journeyIds).toEqual([]);
    expect(loose?.records).toEqual([]);
  });

  it('keeps edges as exact within-flow evidence, with authored labels and no claimed clicks', () => {
    const m = checkout();
    const map = todayScreenMap(m);
    const expected = todayWireflows(m).routes.flatMap((route) =>
      route.connectors.map((connector) => ({ route, connector })),
    );
    expect(map.edges).toHaveLength(expected.length);
    expect(map.edges).toHaveLength(3);
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
    const basket = recorded(map.edges.find((e) => e.flowId === 'flow:add-to-basket'));
    expect(basket).toMatchObject({
      label: 'Add the line',
      regionName: 'Add to basket',
      labelSource: 'authored-action',
    });
    const email = recorded(map.edges.find((e) => e.sourceStepId === 'flow:place-order#email'));
    expect(email.label).toBe('Email the confirmation');
    expect(email.relationship).toBe('recorded-order');
  });

  it('distinguishes explicit initiating controls, unknown controls and recorded outputs', () => {
    const m = checkout();
    const { edges } = todayScreenMap(m);
    expect(edges.find((e) => e.flowId === 'flow:add-to-basket')).toMatchObject({
      label: 'Add the line',
      displayLabel: 'Add to basket',
      labelEvidence: 'explicit-trigger',
    });
    expect(edges.find((e) => e.sourceStepId === 'flow:place-order#email')).toMatchObject({
      label: 'Email the confirmation',
      displayLabel: 'Next screen',
      labelEvidence: 'recorded-order',
    });
    const email = edges.find((e) => e.destinationStepId === 'flow:place-order#email');
    const step = m.asIs.get('flow:place-order#email');
    expect(email).toMatchObject({
      label: 'Send the basket',
      displayLabel: step?.$type === 'step' ? step.action : '',
      labelEvidence: 'recorded-output',
    });
  });

  it.each([
    'The customer reaches the product page.',
    'The customer presses **Continue**.',
    'The customer sees **Add to basket**.',
    'The customer presses **Add to basket** and checks out.',
    'If the customer presses **Add to basket**.',
    'The merchandiser presses **Add to basket**.',
    'The customer presses **Add to basket later**.',
  ])('does not label a control from the trigger “%s”', (trigger) => {
    const m = checkout({
      edit(plan) {
        flowOf(plan, 'flow:add-to-basket').trigger = trigger;
      },
    });
    const edge = todayScreenMap(m).edges.find((e) => e.flowId === 'flow:add-to-basket');
    expect(edge).toMatchObject({
      displayLabel: 'Next screen',
      labelEvidence: 'recorded-order',
      label: 'Add the line',
    });
  });

  it.each(['The customer clicks the **Add to basket** button.', 'Customer taps “Add to basket”.'])(
    'labels the control from the complete trigger “%s”',
    (trigger) => {
      const m = checkout({
        edit(plan) {
          flowOf(plan, 'flow:add-to-basket').trigger = trigger;
        },
      });
      expect(todayScreenMap(m).edges.find((e) => e.flowId === 'flow:add-to-basket')).toMatchObject({
        displayLabel: 'Add to basket',
        labelEvidence: 'explicit-trigger',
      });
    },
  );

  it('does not label a later source or screen connection as a clicked control', () => {
    const multi = checkout({
      edit(plan) {
        stepOf(flowOf(plan, 'flow:add-to-basket'), 1).screen = 'scr:product-page#buy';
      },
    });
    expect(
      todayScreenMap(multi).edges.find((e) => e.flowId === 'flow:add-to-basket'),
    ).toMatchObject({
      displayLabel: 'Next screen',
      labelEvidence: 'recorded-order',
    });
    const later = checkout({
      edit(plan) {
        const flow = flowOf(plan, 'flow:add-to-basket');
        stepOf(flow, 1).screen = 'scr:confirmation';
        stepOf(flow, 2).screen = 'scr:product-page#buy';
        flow.steps.push({
          ...stepOf(flow, 2),
          id: 'flow:add-to-basket#later-basket',
          screen: 'scr:basket#lines',
        });
      },
    });
    expect(
      todayScreenMap(later).edges.find((e) => e.sourceStepId === 'flow:add-to-basket#show'),
    ).toMatchObject({ displayLabel: 'Next screen', labelEvidence: 'recorded-order' });
  });

  it('groups journeys by actor without connecting adjacent tasks', () => {
    const m = checkout();
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
    expect(map.groups.map((g) => g.actor)).toEqual(['Customer']);
    for (const edge of map.edges) {
      expect(edge.steps.every((s) => s.stepId.startsWith(`${edge.flowId}#`))).toBe(true);
    }
    expect(map.edges.some((e) => e.source === 'scr:confirmation')).toBe(false);
    expect(map.edges.some((e) => e.source === e.destination)).toBe(false);
  });

  it('keeps repeated visits as one node and same-screen actions without self-navigation', () => {
    const repeated = checkout({
      edit(plan) {
        const flow = flowOf(plan, 'flow:add-to-basket');
        stepOf(flow, 1).screen = 'scr:basket';
        stepOf(flow, 2).screen = 'scr:product-page';
      },
    });
    const map = todayScreenMap(repeated);
    const journey = map.journeys.find((j) => j.id === 'flow:add-to-basket');
    expect(map.nodes).toHaveLength(5);
    expect(map.nodes.filter((n) => n.id === 'scr:product-page')).toHaveLength(1);
    expect(journey?.nodeIds).toEqual(['scr:product-page', 'scr:basket', 'scr:product-page']);
    expect(
      map.edges.filter((e) => e.flowId === journey?.id).map((e) => [e.source, e.destination]),
    ).toEqual([
      ['scr:product-page', 'scr:basket'],
      ['scr:basket', 'scr:product-page'],
    ]);
    const page = map.nodes.find((n) => n.id === 'scr:product-page');
    expect(
      page?.records
        .filter((r) => r.flowId === 'flow:add-to-basket')
        .map((r) => [r.stepId, r.stopIndex, r.visitIndex]),
    ).toEqual([
      ['flow:add-to-basket#add', 0, 0],
      ['flow:add-to-basket#show', 2, 1],
    ]);
    const graph = todayScreenMap(checkout());
    expect(graph.edges.filter((e) => e.flowId === 'flow:view-product')).toHaveLength(0);
    const product = graph.nodes.find((n) => n.id === 'scr:product-page');
    expect(
      product?.records.filter((r) => r.flowId === 'flow:view-product').map((r) => r.stepId),
    ).toEqual(['flow:view-product#open', 'flow:view-product#stock']);
    expect(graph.edges.every((e) => e.source !== e.destination)).toBe(true);
  });

  it('ignores proposal scenarios, screen pictures, names and newly linked steps', () => {
    const original = todayScreenMap(checkout());
    const changed = checkout({
      edit(plan) {
        plan.problem.scenarios?.reverse();
        plan.changes?.[0]?.ops.push(
          {
            modify: 'scr:basket',
            set: { name: 'Future screen name', image: 'assets/future.svg' },
          },
          {
            add: 'step',
            into: 'flow:add-to-basket',
            after: 'flow:add-to-basket#add',
            value: {
              id: 'flow:add-to-basket#new-navigation',
              action: 'Click future navigation',
              from: 'svc:shop-web',
              to: 'svc:shop-bff',
              via: 'api:bff-add-line',
              screen: 'scr:confirmation',
            },
          },
        );
      },
    });
    expect(changed.toBe.has('flow:add-to-basket#new-navigation')).toBe(true);
    expect(todayScreenMap(changed)).toEqual(original);
  });
});

describe('todayScreenMap: authored interactions', () => {
  it('draws navigation independently of backend flows, one node per screen', () => {
    const m = checkout({ authored: true });
    const map = todayScreenMap(m);
    expect(map.explicit).toBe(true);
    expect(map.nodes.map((n) => n.id)).toEqual(m.asIs.screens.map((s) => s.id));
    const has = (source: string, destination: string) =>
      map.edges.some((e) => e.source === source && e.destination === destination);
    expect(has('scr:basket', 'scr:order-email')).toBe(true);
    expect(has('scr:search-results', 'scr:product-page')).toBe(true);
    expect(has('scr:basket', 'scr:product-page')).toBe(true);
    const standalone = checkout({
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

  it('records each shared entrance once and keeps an ordered journey through a return', () => {
    const m = checkout({ authored: true });
    const map = todayScreenMap(m);
    const shared = map.edges.filter(
      (e) => e.relationship === 'interaction' && e.interactionId === 'ui:header-basket',
    );
    const authored = m.asIs.get('ui:header-basket');
    if (authored?.$type !== 'interaction') throw new Error('no interaction');
    expect(shared.map((e) => e.source)).toEqual(authored.from.map((id) => id.split('#')[0]));
    expect(
      shared.every(
        (e) => e.relationship === 'interaction' && e.shared && e.destination === 'scr:basket',
      ),
    ).toBe(true);
    expect(shared).toHaveLength(3);
    expect(new Set(shared.map((e) => e.id)).size).toBe(shared.length);
    const returning = map.journeys.find(
      (j) => j.explicit && j.interactionIds.includes('ui:basket-product'),
    );
    expect(returning?.nodeIds).toEqual(['scr:basket', 'scr:product-page', 'scr:basket']);
    expect(map.nodes.filter((n) => n.id === 'scr:basket')).toHaveLength(1);
    for (const journey of map.journeys) {
      if (!journey.explicit) throw new Error('recorded journey');
      expect(
        journey.edgeIds.map((id) => interaction(map.edges.find((e) => e.id === id)).interactionId),
      ).toEqual(journey.interactionIds);
    }
  });

  it('retains conditions, results and exact supporting steps', () => {
    const map = todayScreenMap(checkout({ authored: true }));
    const output = interaction(
      map.edges.find(
        (e) => e.relationship === 'interaction' && e.interactionId === 'ui:place-order',
      ),
    );
    expect(output).toMatchObject({
      kind: 'output',
      condition: 'Payment succeeds and the order is created.',
      result: 'The customer receives an order confirmation email.',
      sourceStepId: 'flow:place-order#submit',
      destinationStepId: 'flow:place-order#email',
      flowId: 'flow:place-order',
    });
    expect(output.steps.map((s) => s.stepId)).toContain('flow:place-order#create');
    expect(
      map.edges.every((e) => e.relationship === 'interaction' && e.displayLabel === e.label),
    ).toBe(true);
  });

  it('keeps proposed navigation out of the current network', () => {
    const original = todayScreenMap(checkout({ authored: true }));
    const m = checkout({
      authored: true,
      edit(plan) {
        plan.changes?.[0]?.ops.push({
          modify: 'ui:search-product',
          set: { name: 'Future control', to: 'scr:basket' },
        });
        plan.problem.scenarios?.reverse();
      },
    });
    expect(m.toBe.get('ui:search-product')).toMatchObject({ to: 'scr:basket' });
    expect(todayScreenMap(m)).toEqual(original);
  });

  it('keeps a same-screen update as its explicit effect', () => {
    const m = checkout({
      authored: true,
      edit(plan) {
        plan.interactions?.push({
          id: 'ui:update-product',
          name: 'Choose colour',
          from: ['scr:product-page'],
          to: 'scr:product-page',
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
    expect(edge).toMatchObject({
      source: 'scr:product-page',
      destination: 'scr:product-page',
      kind: 'update',
    });
  });

  it('gives a journey that begins at shared navigation every entrance, without inventing order', () => {
    const m = checkout({
      authored: true,
      edit(plan) {
        plan.user_journeys?.push({
          id: 'uj:shared-basket',
          name: 'Visit the basket then the product',
          actor: 'Customer',
          interactions: ['ui:header-basket', 'ui:basket-product'],
        });
      },
    });
    const journey = todayScreenMap(m).journeys.find((j) => j.id === 'uj:shared-basket');
    const sources = m.asIs.get('ui:header-basket');
    if (journey?.explicit !== true || sources?.$type !== 'interaction') throw new Error('missing');
    expect(journey.entranceIds).toEqual(sources.from);
    expect(sources.from.every((id) => journey.nodeIds.includes(id))).toBe(true);
    expect(journey.edgeIds).toHaveLength(sources.from.length + 1);
  });

  it('skips an interaction whose screens are not baseline screens', () => {
    const m = checkout({
      authored: true,
      edit(plan) {
        plan.interactions?.push({
          id: 'ui:nowhere',
          name: 'Go nowhere',
          from: ['scr:product-page'],
          to: 'scr:missing',
          trigger: 'click',
          effect: 'navigate',
        });
      },
    });
    expect(todayScreenMap(m).edges.some((e) => e.id.startsWith('ui:nowhere'))).toBe(false);
  });
});
