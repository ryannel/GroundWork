// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { sameDay } from '@/../test/fixtures/acme/plans/chapters-same-day';
import { reworkCheckout } from '@/../test/fixtures/acme/plans/contracts-rework-checkout';
import { orderEventV2 } from '@/../test/fixtures/acme/plans/versions-order-event';
import { dispatchDate } from '@/../test/fixtures/acme/plans/work-dispatch';
import { modelOf, planOnAcme } from '@/../test/plan-kit';
import type { Model } from '@/application/plan/derive';
import { changedStepIds, flowHead, screenClaim } from '@/application/plan-story-changes-flows';
import type { Change, Op } from '@/domain/plan/plan.generated';

function modelWith(...changes: readonly [Change, ...Change[]]): Model {
  const on = planOnAcme({
    meta: {
      id: 'flows',
      title: 'Flows',
      version: '1.0',
      date: '2026-05-20',
      status: 'draft',
      authors: ['Orders'],
    },
    problem: { summary: 'Flows move.', why: 'To see them said.', goals: ['Say it'] },
    changes: [...changes],
  });
  return modelOf(on.plan);
}

const step = (id: string, action: string): Op => ({
  add: 'step',
  into: 'flow:publish-product',
  value: {
    id: `flow:publish-product#${id}`,
    from: 'svc:products',
    to: 'svc:products',
    via: 'api:products-update',
    action,
  },
});

describe('a flow’s headline', () => {
  it('reads the flow’s own props when no step changes', () => {
    const untitled = modelWith({
      id: 'chg:trigger',
      title: '. ',
      ops: [{ modify: 'flow:cancel-order', set: { trigger: 'A call.', outcome: 'Gone.' } }],
    });
    expect(flowHead(untitled, 'flow:cancel-order')).toEqual({
      head: 'Cancel an order: its trigger and outcome change',
      lede: '',
    });
    expect(changedStepIds(untitled, 'flow:cancel-order')).toEqual([]);
    const titled = modelWith({
      id: 'chg:trigger',
      title: 'Ring first.',
      ops: [{ modify: 'flow:cancel-order', set: { trigger: 'A call.' } }],
    });
    expect(flowHead(titled, 'flow:cancel-order')).toEqual({
      head: 'Ring first',
      lede: 'Its trigger changes.',
    });
  });

  it('counts rewrites, removals and deprecations, keeping removed steps in place', () => {
    const model = modelWith({
      id: 'chg:rewrite',
      title: 'Rewrite the order',
      ops: [
        { remove: 'flow:place-order#card' },
        { remove: 'flow:place-order#submit' },
        { modify: 'flow:place-order#create', set: { action: 'Make it' } },
        { modify: 'flow:place-order#charge', set: { action: 'Charge it' } },
        { modify: 'flow:place-order#publish', set: { via: 'msg:order-placed', action: 'Say it' } },
        { deprecate: 'flow:place-order#email' },
      ],
    });
    expect(flowHead(model, 'flow:place-order')).toEqual({
      head: 'Rewrite the order',
      lede: 'Three steps change, two are removed, one is deprecated.',
    });
    expect(changedStepIds(model, 'flow:place-order')).toEqual([
      'flow:place-order#submit',
      'flow:place-order#create',
      'flow:place-order#charge',
      'flow:place-order#card',
      'flow:place-order#publish',
      'flow:place-order#email',
    ]);
  });

  it('counts via switches to different places as plain changes', () => {
    const model = modelWith({
      id: 'chg:publish',
      title: 'Publish differently',
      ops: [
        { modify: 'flow:publish-product#announce', set: { via: 'api:products-update' } },
        { modify: 'flow:publish-product#index', set: { via: 'api:orders-cancel' } },
        { remove: 'flow:publish-product#save' },
        step('x', 'X'),
        step('y', 'Y'),
      ],
    });
    expect(flowHead(model, 'flow:publish-product')).toEqual({
      head: 'Publish differently',
      lede: 'Two steps change, two are added, one is removed.',
    });
    expect(changedStepIds(model, 'flow:publish-product')[0]).toBe('flow:publish-product#save');
  });

  it('names what several steps switch to, and what else changes', () => {
    const model = modelWith({
      id: 'chg:switch',
      title: 'Switch the publishing',
      ops: [
        { modify: 'flow:publish-product#announce', set: { via: 'api:products-update' } },
        { modify: 'flow:publish-product#index', set: { via: 'api:products-update' } },
        { modify: 'flow:publish-product#save', set: { action: 'Keep it' } },
      ],
    });
    expect(flowHead(model, 'flow:publish-product').lede).toMatch(
      /^Two steps switch to .+, one changes\.$/u,
    );
    expect(flowHead(modelOf(sameDay()), 'flow:place-order').lede).toBe(
      'Two steps switch to v2, one changes.',
    );
    expect(flowHead(modelOf(orderEventV2()), 'flow:place-order')).toEqual({
      head: 'The mailer and the order desk read v2',
      lede: 'Two steps switch to v2, one is added.',
    });
  });

  it('says nothing changes for a flow no change touches, or one it cannot find', () => {
    const model = modelOf(dispatchDate());
    expect(flowHead(model, 'flow:place-order')).toEqual({
      head: 'Place an order: nothing changes',
      lede: '',
    });
    expect(flowHead(model, 'flow:nowhere')).toEqual({
      head: 'flow:nowhere: nothing changes',
      lede: '',
    });
    expect(changedStepIds(model, 'flow:nowhere')).toEqual([]);
    expect(flowHead(model, 'flow:publish-product').lede).toBe(
      'Two steps change, two are added, one is removed.',
    );
  });

  it('says one step is added or removed in the singular', () => {
    expect(flowHead(modelOf(reworkCheckout()), 'flow:cancel-order')).toEqual({
      head: 'Pause an order instead of cancelling it',
      lede: 'One step is removed.',
    });
    expect(flowHead(modelOf(reworkCheckout()), 'flow:publish-product').lede).toBe(
      'One step is added.',
    );
  });
});

describe('a screen’s claim', () => {
  const model = modelWith({
    id: 'chg:screens',
    title: 'Screens',
    ops: [
      { modify: 'scr:product-page', set: { image: 'assets/new.png' } },
      { add: 'region', into: 'scr:product-page', value: { id: 'scr:product-page#a', name: 'A' } },
      { add: 'region', into: 'scr:product-page', value: { id: 'scr:product-page#b', name: 'B' } },
      { remove: 'scr:product-page#buy' },
      { remove: 'scr:confirmation' },
      { add: 'region', into: 'scr:basket', value: { id: 'scr:basket#a', name: 'A' } },
      { modify: 'scr:basket', set: { route: '/b' } },
    ],
  });

  it('counts regions that come and go on a screen with a new look', () => {
    expect(screenClaim(model, 'scr:product-page')).toBe(
      'Product page gets a new look: two new regions, one region goes.',
    );
  });

  it('lists the regions of a screen whose picture stays', () => {
    expect(screenClaim(model, 'scr:basket')).toBe('Basket: one new region.');
  });

  it('says a removed screen goes away', () => {
    expect(screenClaim(model, 'scr:confirmation')).toBe('Order confirmation goes away.');
  });

  it('says a screen with only a new picture gets a new look, and an untouched one changes', () => {
    const rework = modelOf(reworkCheckout());
    expect(screenClaim(rework, 'scr:basket')).toBe('Basket gets a new look.');
    expect(screenClaim(rework, 'scr:confirmation')).toBe('Order confirmation changes.');
    expect(screenClaim(modelOf(dispatchDate()), 'scr:product-page')).toBe(
      'Product page: one region changes.',
    );
  });
});
