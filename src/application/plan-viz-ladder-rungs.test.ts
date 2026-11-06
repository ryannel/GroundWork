import { describe, expect, it } from 'vitest';

import { dispatchDate } from '@/../test/fixtures/acme/plans/work-dispatch';
import { modelOf } from '@/../test/plan-kit';
import type { Plan } from '@/domain/plan/plan.generated';

import { ladderView } from './plan-viz-ladder-rungs';

const event = 'msg:product-changed';
function apiPlan(): Plan {
  return {
    meta: { id: 'api-version', title: 'Version the API' },
    problem: { summary: 'Move callers safely.' },
    teams: [],
    services: [
      { id: 'svc:provider', name: 'Provider', kind: 'service' },
      { id: 'svc:caller', name: 'Caller', kind: 'service' },
    ],
    interfaces: [
      {
        id: 'if:v1',
        service: 'svc:provider',
        protocol: 'rest',
        endpoints: [{ id: 'api:v1', sig: 'GET /v1/items' }],
      },
    ],
    flows: [
      {
        id: 'flow:fetch',
        name: 'Fetch',
        steps: [
          {
            id: 'flow:fetch#call',
            from: 'svc:caller',
            to: 'svc:provider',
            via: 'api:v1',
            action: 'Fetch items',
          },
        ],
      },
    ],
    changes: [
      {
        id: 'chg:expand',
        title: 'Offer v2',
        ops: [
          {
            add: 'endpoint',
            into: 'if:v1',
            value: { id: 'api:v2', sig: 'GET /v2/items', supersedes: 'api:v1' },
          },
        ],
      },
      {
        id: 'chg:migrate',
        title: 'Move the caller',
        ops: [{ modify: 'flow:fetch#call', set: { via: 'api:v2' } }],
      },
      {
        id: 'chg:deprecate',
        title: 'Keep v1 during migration',
        ops: [{ deprecate: 'api:v1', replaced_by: 'api:v2' }],
      },
      { id: 'chg:retire', title: 'Remove v1', ops: [{ remove: 'api:v1' }] },
    ],
  };
}
describe('migration rung descriptions', () => {
  it('states what expands, which consumers move, what stays published and what is removed', () => {
    const view = ladderView(modelOf(dispatchDate()), event);
    expect(view?.chain).toEqual([event, 'msg:product-changed-v2']);
    expect(view?.rungs.map((rung) => rung.what)).toEqual([
      [
        { text: 'Products API starts publishing ' },
        { text: 'v2', tone: 'strong' },
        { text: ' next to v1' },
      ],
      [
        { text: 'Search indexer', tone: 'who', id: 'svc:search-indexer' },
        { text: ' reads v2 instead of v1' },
      ],
      [
        { text: 'Order API', tone: 'who', id: 'svc:order-api' },
        { text: ' reads v2 instead of v1' },
      ],
      [
        { text: 'v1', tone: 'strong' },
        { text: ' marked deprecated ' },
        { text: '(still published)', tone: 'still' },
      ],
      [{ text: 'Products API stops publishing ' }, { text: 'v1', tone: 'strong' }],
    ]);
    expect(view?.legend).toEqual([
      'Expand: add the new version next to the old one',
      'Migrate: move one consumer to the new version',
      'Deprecate: mark the old version deprecated; it is still served',
      'Remove: remove the old version once nobody reads it',
    ]);
    expect(view?.keepsOld).toBe(false);
  });
  it('shows meaningful edits, explains a pure switch once, and associates each work item once', () => {
    const view = ladderView(modelOf(dispatchDate()), event);
    expect(
      view?.rungs.map((rung) => rung.ops.map(({ change, text, more }) => ({ change, text, more }))),
    ).toEqual([
      [
        { change: 'added', text: 'event "product.changed v2"', more: false },
        {
          change: 'added',
          text: 'step "Announce the change as v2" after "Index the product"',
          more: false,
        },
      ],
      [],
      [
        {
          change: 'added',
          text: 'step "Keep the dispatch days" after "Announce the change as v2"',
          more: false,
        },
      ],
      [{ change: 'deprecated', text: 'deprecated v1 → v2', more: false }],
      [
        { change: 'removed', text: 'step "Announce the change"', more: false },
        { change: 'removed', text: 'event "product.changed"', more: false },
      ],
    ]);
    expect(view?.rungs.map((rung) => rung.note)).toEqual([
      null,
      'Moves “Index the product” to the new version, and stops reading the old one.',
      null,
      null,
      null,
    ]);
    expect(view?.rungs.map((rung) => rung.items)).toEqual([
      [{ id: 'wi:publish-v2', label: 'Publish product.changed v2' }],
      [{ id: 'wi:indexer-v2', label: 'Index from v2' }],
      [{ id: 'wi:orders-v2', label: 'Keep dispatch days on orders' }],
      [],
      [{ id: 'wi:retire-v1', label: 'Remove product.changed v1' }],
    ]);
    expect(view?.rungs.map((rung) => rung.teams)).toEqual([
      ['team:catalogue'],
      ['team:catalogue'],
      ['team:orders'],
      ['team:catalogue'],
      ['team:catalogue'],
    ]);
    expect(view?.rungs.every((rung) => !rung.noItems)).toBe(true);
  });
  it('keeps the planned milestones and flags switching or removing before prerequisites', () => {
    const value = dispatchDate();
    expect(ladderView(modelOf(value), event)?.rungs.map((rung) => rung.when)).toEqual([
      { text: 'planned M1', late: false, title: 'Planned in M1 · Dates exist' },
      { text: 'planned M2', late: false, title: 'Planned in M2 · Readers move' },
      { text: 'planned M2', late: false, title: 'Planned in M2 · Readers move' },
      { text: 'planned M1', late: false, title: 'Planned in M1 · Dates exist' },
      { text: 'planned M4', late: false, title: 'Planned in M4 · v1 is gone' },
    ]);
    const publish = value.work_items?.find((item) => item.id === 'wi:publish-v2');
    const retire = value.work_items?.find((item) => item.id === 'wi:retire-v1');
    publish!.milestone = 'ms:m4';
    retire!.milestone = 'ms:m1';
    const view = ladderView(modelOf(value), event);
    expect(view?.rungs[1]?.when).toEqual({
      text: 'planned M2, before the new version is published',
      late: true,
      title: 'Scheduled before the rung it depends on',
    });
    expect(view?.rungs[4]?.when).toEqual({
      text: 'planned M1, before the last consumer has moved',
      late: true,
      title: 'Scheduled before the rung it depends on',
    });
  });
  it('does not invent dates or work for a rung, and includes issue numbers when recorded', () => {
    const value = dispatchDate();
    value.work_items!.find((item) => item.id === 'wi:publish-v2')!.github_issue = 12;
    expect(ladderView(modelOf(value), event)?.rungs[0]?.items[0]?.label).toBe(
      '#12 Publish product.changed v2',
    );
    value.work_items = [];
    const view = ladderView(modelOf(value), event);
    expect(
      view?.rungs.every((rung) => rung.noItems && rung.items.length === 0 && rung.when === null),
    ).toBe(true);
    expect(ladderView(modelOf(value), 'msg:missing')).toBeNull();
    expect(ladderView(modelOf(value), 'sch:product')).toBeNull();
  });
  it('uses API language for serving, caller migration and deprecation, retaining an old version until removal', () => {
    const value = apiPlan();
    const view = ladderView(modelOf(value), 'api:v1');
    expect(view?.rungs.map((rung) => rung.what.map((segment) => segment.text).join(''))).toEqual([
      'Provider starts serving GET /v2/items next to GET /v1/items',
      'Caller calls GET /v2/items instead of GET /v1/items',
      'GET /v1/items marked deprecated (still served)',
      'Provider stops serving GET /v1/items',
    ]);
    expect(view?.rungs[1]?.note).toBe(
      'Moves “Fetch items” to the new version, and stops reading the old one.',
    );
    value.changes = value.changes!.filter((change) => change.id !== 'chg:retire');
    const kept = ladderView(modelOf(value), 'api:v1');
    expect(kept?.keepsOld).toBe(true);
    expect(kept?.legend).toEqual([
      'Expand: add the new version next to the old one',
      'Migrate: move one consumer to the new version',
      'Deprecate: mark the old version deprecated; it is still served',
    ]);
  });
});
