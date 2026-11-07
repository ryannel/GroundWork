import { describe, expect, it } from 'vitest';

import { emptyQueryModel } from '@/../test/fixtures/model-queries';
import { indexOf } from '@/application/model-index';

import { modelTeamSlotOf } from './model-team';

describe('native team palette', () => {
  it('retains the existing one-based team-order cycle and unknown slot', () => {
    const index = indexOf({
      ...emptyQueryModel(),
      teams: Array.from({ length: 14 }, (_, at) => ({
        id: `team:${String(at)}`,
        name: `Team ${String(at)}`,
      })),
    });
    expect(
      Array.from({ length: 14 }, (_, at) => modelTeamSlotOf(index, `team:${String(at)}`)),
    ).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2]);
    expect(modelTeamSlotOf(index, 'team:unknown')).toBe(8);
    expect(modelTeamSlotOf(index, null)).toBe(8);
  });

  it('uses valid authored colours through thirteen and falls back for out-of-range values', () => {
    const index = indexOf({
      ...emptyQueryModel(),
      teams: [
        { id: 'team:one', name: 'One', colour: 13 },
        { id: 'team:two', name: 'Two', colour: 0 },
        { id: 'team:three', name: 'Three', colour: 14 },
      ],
    });
    expect(modelTeamSlotOf(index, 'team:one')).toBe(13);
    expect(modelTeamSlotOf(index, 'team:two')).toBe(2);
    expect(modelTeamSlotOf(index, 'team:three')).toBe(3);
  });
});
