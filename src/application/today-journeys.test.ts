// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { acme } from '@/../test/workspace-kit';
import { derive } from '@/application/plan/derive';
import { journeyGroups } from '@/application/plan-story-journey-groups';

import { flowsByStage, journeyClaim, journeysHeadline, todayJourneysOf } from './today-journeys';

function today() {
  return acme().today.model;
}

describe('the journeys of today', () => {
  it('puts user journeys first and keeps every flow group key', () => {
    const model = today();
    const journeys = todayJourneysOf(model);
    const kinds = journeys.map((j) => j.kind);
    expect(kinds.indexOf('flow')).toBeGreaterThan(kinds.lastIndexOf('journey'));
    const keys = journeys.map((j) => j.key);
    for (const group of journeyGroups(model)) expect(keys).toContain(group.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(key).toMatch(/^[\w-]+$/u);
    expect(keys).toEqual([
      'uj-buy',
      'flow-cancel-order',
      'flow-place-order',
      'flow-publish-product',
    ]);
  });

  it('tells who starts each journey and which systems it crosses', () => {
    const journeys = todayJourneysOf(today());
    for (const journey of journeys) {
      expect(journey.flows.length).toBeGreaterThan(0);
      expect(journeyClaim(journey)).not.toBe('');
    }
    expect(journeys.find((j) => j.key === 'flow-place-order')).toMatchObject({
      actor: 'Customer',
      systems: ['sys:shop', 'sys:ordering', 'sys:payments'],
      steps: 6,
    });
    expect(journeysHeadline(journeys)).toMatch(/journey|flow/u);
  });

  it('crosses the containing system of a store independently of its owner', () => {
    const { today: source } = acme();
    const placements = Object.fromEntries(
      [...source.model.asIs.byId.keys()].map((id) => [id, source.model.place(id) ?? undefined]),
    );
    const model = derive(
      {
        ...source.plan,
        stores: (source.plan.stores ?? []).map((store) => ({ ...store, owner: 'svc:products' })),
        user_journeys: [],
        flows: [
          {
            id: 'flow:store-only',
            name: 'Store walk',
            actor: 'Fixture',
            steps: [
              {
                id: 'flow:store-only#stay',
                action: 'Read the store',
                from: 'st:orders-db',
                to: 'st:orders-db',
                via: 'api:orders-create',
              },
            ],
          },
        ],
      },
      { placements },
    );
    expect(todayJourneysOf(model)[0]?.systems).toEqual(['sys:ordering']);
  });

  it('files every flow under exactly one stage', () => {
    const model = today();
    const journeys = todayJourneysOf(model);
    const flows = journeys.filter((j) => j.kind === 'flow');
    const filed = flowsByStage(model, journeys).flatMap((stage) => stage.journeys);
    expect(new Set(filed.map((j) => j.key))).toEqual(new Set(flows.map((j) => j.key)));
    expect(filed).toHaveLength(flows.length);
    expect(flowsByStage(model, journeys).map((stage) => stage.title)).toEqual(['Publish', 'Buy']);
  });
});
