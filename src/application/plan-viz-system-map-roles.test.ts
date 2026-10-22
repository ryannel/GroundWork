import { describe, expect, it } from 'vitest';

import { roleIndex, roleSpansOf } from './plan-viz-system-map-roles';

describe('roleSpansOf', () => {
  it('heads each column with the tier it shows, in the order a request travels', () => {
    const used = (['channel', 'gateway', 'forward', 'backend', 'upstream'] as const).map(roleIndex);
    expect(roleSpansOf(used).map(({ name, from }) => [name, from])).toEqual([
      ['Channels', 0],
      ['Gateway', 1],
      ['Forward-facing', 2],
      ['Back end', 3],
      ['Upstream sources', 4],
    ]);
  });

  it('closes up a tier no system sits in', () => {
    const used = [roleIndex('channel'), roleIndex('backend')];
    expect(roleSpansOf(used).map(({ role, from }) => [role, from])).toEqual([
      ['channel', 0],
      ['backend', 1],
    ]);
  });
});
