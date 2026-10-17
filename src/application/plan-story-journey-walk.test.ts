// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { giftWrap } from '@/../test/fixtures/acme/plans/journeys-gift-wrap';
import { modelOf } from '@/../test/plan-kit';
import { journeyGroups } from '@/application/plan-story-journey-groups';
import {
  entryOf,
  positionOf,
  progressOf,
  stopBeside,
  walkOf,
} from '@/application/plan-story-journey-walk';

const load = () => modelOf(giftWrap());

function scenario(key: string) {
  const model = load();
  const group = journeyGroups(model).find((g) => g.key === key);
  if (group === undefined) throw new Error(`no ${key}`);
  return { model, walk: walkOf(model, group.flows), group };
}

describe('the walk through a scenario', () => {
  it('lines up every step of every flow in the scenario, in order', () => {
    const { walk, group } = scenario('sc-birthday-gift');
    expect(group.flows.length).toBeGreaterThan(1);
    expect([...new Set(walk.positions.map((p) => p.flowId))]).toEqual(group.flows);
    expect(walk.titles.asIs).toHaveLength(walk.positions.length);
  });

  it('stops only where the view has the step', () => {
    const { model, walk } = scenario('sc-birthday-gift');
    for (const i of walk.stops.toBe) {
      const p = walk.positions[i];
      expect(p?.stepId === null || model.toBe.has(p?.stepId ?? '')).toBe(true);
    }
    expect(walk.stops.toBe.length).toBeGreaterThan(walk.stops.asIs.length);
  });

  it('steps across flows, and stops at the ends of the line', () => {
    const { walk } = scenario('sc-birthday-gift');
    const last = entryOf(walk, 'asIs', -1);
    expect(stopBeside(walk, { index: last, mode: 'asIs' }, 1)).toBeNull();
    expect(stopBeside(walk, { index: entryOf(walk, 'asIs', 1), mode: 'asIs' }, -1)).toBeNull();
    const firstOfSecond = walk.positions.findIndex((p) => p.flowId !== walk.positions[0]?.flowId);
    expect(firstOfSecond).toBeGreaterThan(0);
    const before = stopBeside(walk, { index: firstOfSecond, mode: 'toBe' }, -1);
    expect(walk.positions[before ?? 0]?.flowId).toBe(walk.positions[0]?.flowId);
  });

  it('counts the steps of the view across the scenario', () => {
    const { walk } = scenario('sc-birthday-gift');
    const first = entryOf(walk, 'toBe', 1);
    expect(progressOf(walk, { index: first, mode: 'toBe' })).toBe(
      `Step 1 of ${String(walk.stops.toBe.length)} in this scenario`,
    );
    const added = walk.positions.findIndex((_, i) => !walk.stops.asIs.includes(i));
    expect(progressOf(walk, { index: added, mode: 'asIs' })).toBe('Not in this view');
  });

  it('counts no steps today in a flow the plan adds', () => {
    const model = load();
    const walk = walkOf(model, ['flow:wrap-order']);
    expect(walk.missing.asIs).toEqual(['flow:wrap-order']);
    expect(progressOf(walk, { index: entryOf(walk, 'asIs', 1), mode: 'asIs' })).toBe(
      'Not in this view',
    );
    expect(progressOf(walk, { index: 0, mode: 'toBe' })).toMatch(/^Step 1 of \d+$/u);
  });

  it('finds a position by step id, or by flow id at the flow’s start', () => {
    const { walk } = scenario('sc-birthday-gift');
    const p = walk.positions[3];
    expect(positionOf(walk, p?.stepId ?? '')).toBe(3);
    expect(positionOf(walk, p?.flowId ?? '')).toBe(
      walk.positions.findIndex((q) => q.flowId === p?.flowId),
    );
    expect(positionOf(walk, 'nothing')).toBe(-1);
  });

  it('has nothing to walk when the scenario has no flows', () => {
    const model = load();
    const walk = walkOf(model, []);
    expect(walk.positions).toEqual([]);
    expect(progressOf(walk, { index: 0, mode: 'asIs' })).toBe('Not in this view');
  });
});
