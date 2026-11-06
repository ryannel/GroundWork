import { describe, expect, it } from 'vitest';

import { dispatchDate } from '@/../test/fixtures/acme/plans/work-dispatch';
import { modelOf } from '@/../test/plan-kit';

import { otherChanges, teamPart } from './plan-story-part';

const ids = (values: readonly { readonly id: string }[]) => values.map((value) => value.id);

describe('a team’s part in a plan', () => {
  it('keeps Catalogue services, changes, proofs and work in authored order, with the critical path distinguished', () => {
    const model = modelOf(dispatchDate());
    const part = teamPart(model, 'team:catalogue');
    expect(part).toMatchObject({
      stage: 'draft',
      services: ['svc:products', 'svc:product-admin', 'svc:search-indexer', 'svc:search-api'],
      changes: [
        'chg:dispatch-field',
        'chg:product-changed-v2',
        'chg:indexer-reads-v2',
        'chg:retire-v1',
      ],
      tests: ['tst:dispatch-unit', 'tst:indexer-contract', 'tst:no-v1-left'],
      decides: [],
      waitsOn: [],
      risksOn: [],
      alsoOpen: [],
      left: [],
      started: false,
    });
    expect(ids(part.work)).toEqual([
      'wi:dispatch-field',
      'wi:publish-v2',
      'wi:indexer-v2',
      'wi:retire-v1',
    ]);
    expect(ids(part.onPath)).toEqual(['wi:dispatch-field', 'wi:publish-v2', 'wi:retire-v1']);
    expect(part.steps).toEqual([
      {
        flow: 'flow:publish-product',
        id: 'flow:publish-product#save',
        kind: 'differently',
        action: 'Save the product',
        from: 'svc:product-admin',
        to: 'svc:products',
        via: 'api:products-update',
        caller: null,
        sameCall: false,
      },
      {
        flow: 'flow:publish-product',
        id: 'flow:publish-product#index',
        kind: 'rerouted',
        action: 'Index the product',
        from: 'st:product-events',
        to: 'svc:search-indexer',
        via: 'msg:product-changed-v2',
        caller: null,
        sameCall: false,
      },
      {
        flow: 'flow:publish-product',
        id: 'flow:publish-product#announce-v2',
        kind: 'new',
        action: 'Announce the change as v2',
        from: 'svc:products',
        to: 'st:product-events',
        via: 'msg:product-changed-v2',
        caller: null,
        sameCall: false,
      },
      {
        flow: 'flow:publish-product',
        id: 'flow:publish-product#orders',
        kind: 'new',
        action: 'Keep the dispatch days',
        from: 'st:product-events',
        to: 'svc:order-api',
        via: 'msg:product-changed-v2',
        caller: null,
        sameCall: false,
      },
    ]);
    expect(otherChanges(model, part)).toEqual(['chg:retire-v1']);
    expect(otherChanges(model, teamPart(model, 'team:web'))).toEqual(['chg:shop-shows-date']);
  });
  it('keeps an outside caller visible when its route is unchanged but the work inside changes', () => {
    const value = dispatchDate();
    value.changes!.push({
      id: 'chg:call-work',
      title: 'Change what order creation does',
      ops: [
        {
          modify: 'flow:place-order#create',
          set: { action: 'Create the order with dispatch days' },
        },
        { deprecate: 'flow:place-order#charge' },
      ],
    });
    const part = teamPart(modelOf(value), 'team:orders');
    expect(part.steps).toContainEqual({
      flow: 'flow:place-order',
      id: 'flow:place-order#create',
      kind: 'differently',
      action: 'Create the order with dispatch days',
      from: 'svc:shop-bff',
      to: 'svc:order-api',
      via: 'api:orders-create',
      caller: 'svc:shop-bff',
      sameCall: true,
    });
    expect(part.steps.find((step) => step.id === 'flow:place-order#charge')).toMatchObject({
      kind: 'removed',
      action: 'Take payment',
      caller: null,
      sameCall: false,
    });
  });
  it('distinguishes another team’s blocking choice from its own decisions and unrelated work', () => {
    const value = dispatchDate();
    value.questions = [
      {
        id: 'q:cross',
        question: 'Which regions?',
        status: 'open',
        decider: 'team:catalogue',
        blocks: ['wi:shop-date', 'chg:shop-shows-date', 'wi:orders-v2'],
      },
      { id: 'q:open', question: 'Which colour?', status: 'open', decider: 'team:web' },
      { id: 'q:resolved', question: 'Which wording?', status: 'resolved', decider: 'team:web' },
    ];
    value.decisions![0]!.status = 'proposed';
    value.risks = [
      {
        id: 'risk:waiting',
        statement: 'Accept the rollout gap',
        owner: 'team:web',
        roam: 'accepted',
        accepted_by: 'dec:days-not-dates',
      },
      {
        id: 'risk:settled',
        statement: 'Accepted already',
        owner: 'team:web',
        roam: 'accepted',
        accepted_by: 'dec:publish-side-by-side',
      },
      {
        id: 'risk:other',
        statement: 'Another owner',
        owner: 'team:orders',
        roam: 'accepted',
        accepted_by: 'dec:days-not-dates',
      },
      {
        id: 'risk:mitigated',
        statement: 'Already mitigated',
        owner: 'team:web',
        roam: 'mitigated',
        accepted_by: 'dec:days-not-dates',
      },
      {
        id: 'risk:unknown',
        statement: 'No accepting choice recorded',
        owner: 'team:web',
        roam: 'accepted',
      },
    ];
    const model = modelOf(value);
    const part = teamPart(model, 'team:web');
    expect(part.waitsOn.map(({ gate, held }) => ({ id: gate.id, held }))).toContainEqual({
      id: 'q:cross',
      held: ['wi:shop-date', 'chg:shop-shows-date'],
    });
    expect(ids(part.decides)).toEqual([]);
    expect(ids(part.risksOn)).toEqual(['risk:waiting']);
    expect(ids(part.alsoOpen)).toEqual(['q:open']);
    expect(ids(teamPart(model, 'team:catalogue').decides)).toContain('q:cross');
  });
  it('shows work as started only when progress is known and keeps completed work out of what remains', () => {
    const value = dispatchDate();
    value.work_items!.find((item) => item.id === 'wi:shop-date')!.github_issue = 42;
    const open = teamPart(
      modelOf(value, { status: { 'wi:shop-date': { state: 'open' } } }),
      'team:web',
    );
    expect(open.started).toBe(true);
    expect(ids(open.left)).toEqual(['wi:shop-date']);
    expect(open.stage).toBe('in-delivery');
    const done = teamPart(
      modelOf(value, { status: { 'wi:shop-date': { state: 'closed' } } }),
      'team:web',
    );
    expect(done.started).toBe(true);
    expect(done.left).toEqual([]);
    const unknown = teamPart(modelOf(value), 'team:missing');
    expect(unknown).toMatchObject({
      services: [],
      changes: [],
      tests: [],
      decides: [],
      waitsOn: [],
      risksOn: [],
      alsoOpen: [],
      work: [],
      onPath: [],
      left: [],
      started: false,
      steps: [],
    });
  });
});
