import { describe, expect, it } from 'vitest';

import { inTurn } from './in-turn';

describe('inTurn', () => {
  it('runs each step after the one before has finished', async () => {
    const seen: string[] = [];
    await inTurn([30, 0, 10], async (delay) => {
      seen.push(`start ${String(delay)}`);
      await new Promise<void>((resolve) => {
        setTimeout(resolve, delay);
      });
      seen.push(`end ${String(delay)}`);
    });
    expect(seen).toEqual(['start 30', 'end 30', 'start 0', 'end 0', 'start 10', 'end 10']);
  });
});
