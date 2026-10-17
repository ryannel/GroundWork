import { describe, expect, it } from 'vitest';

import { NOTHING, orNothing } from './static-params';

describe('orNothing', () => {
  it('keeps the params a route has, and stands one in when it has none', () => {
    expect(orNothing([{ id: 'a' }], { id: NOTHING })).toEqual([{ id: 'a' }]);
    expect(orNothing([], { id: NOTHING })).toEqual([{ id: '_none' }]);
  });
});
