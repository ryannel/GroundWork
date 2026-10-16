// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { journeyGroups } from '@/application/plan-story-journey-groups';

import { flowsByStage, journeyClaim, journeysHeadline, todayJourneysOf } from './today-journeys';

vi.mock('server-only', () => ({}));

async function today() {
  const { todayData } = await import('@/infrastructure/today-data');
  const data = await todayData('alder-finch');
  if (data === null) throw new Error('no alder-finch');
  return data.today.model;
}

describe('the journeys of today', () => {
  it('puts user journeys first and keeps every flow group key', async () => {
    const model = await today();
    const journeys = todayJourneysOf(model);
    const kinds = journeys.map((j) => j.kind);
    expect(kinds.indexOf('flow')).toBeGreaterThan(kinds.lastIndexOf('journey'));
    const keys = journeys.map((j) => j.key);
    for (const group of journeyGroups(model)) expect(keys).toContain(group.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(key).toMatch(/^[\w-]+$/);
  });

  it('tells who starts each journey and which systems it crosses', async () => {
    const journeys = todayJourneysOf(await today());
    for (const journey of journeys) {
      expect(journey.flows.length).toBeGreaterThan(0);
      expect(journeyClaim(journey)).not.toBe('');
    }
    expect(journeys.some((j) => j.systems.length > 0)).toBe(true);
    expect(journeysHeadline(journeys)).toMatch(/journey|flow/);
  });

  it('files every flow under exactly one stage', async () => {
    const model = await today();
    const journeys = todayJourneysOf(model);
    const flows = journeys.filter((j) => j.kind === 'flow');
    const filed = flowsByStage(model, journeys).flatMap((stage) => stage.journeys);
    expect(new Set(filed.map((j) => j.key))).toEqual(new Set(flows.map((j) => j.key)));
    expect(filed).toHaveLength(flows.length);
  });
});
