import { describe, expect, it } from 'vitest';

import { outsideOf, ownFirst } from './plan-viz-system-map-outside';
import type { SystemMapInput } from './plan-viz-system-map-types';

const node = (id: string) => ({ id, name: id, kind: 'service', does: '', team: null, teamSlot: 1 });

const input = {
  services: [
    { ...node('svc:price'), system: 'sys:price' },
    { ...node('svc:fleet'), system: 'sys:fleet' },
    { ...node('svc:customer'), system: 'sys:customer' },
  ],
  systems: [
    node('sys:price'),
    { ...node('sys:fleet'), place: 'Fleet' },
    { ...node('sys:customer'), place: 'Shopping' },
  ],
  focus: ['sys:price', 'svc:price'],
} as unknown as SystemMapInput;

const members = (u: string): readonly string[] =>
  ({ 'sys:price': ['svc:price'], 'sys:fleet': ['svc:fleet'], 'sys:customer': ['svc:customer'] })[
    u
  ] ?? [u];

describe('outsideOf', () => {
  it('finds the systems of other domains, and names their domain', () => {
    const outside = outsideOf(input, true, members);
    expect(outside.units.has('sys:fleet')).toBe(true);
    expect(outside.units.has('sys:price')).toBe(false);
    expect(outside.domainOf('sys:customer')).toBe('Shopping');
  });

  it('keeps nothing apart on a map not read system by system', () => {
    expect(outsideOf(input, false, members).units.size).toBe(0);
  });
});

describe('ownFirst', () => {
  it('puts the domain own systems first, then the others grouped by domain', () => {
    const outside = outsideOf(input, true, members);
    expect(ownFirst(['sys:customer', 'sys:fleet', 'sys:price'], outside)).toEqual([
      'sys:price',
      'sys:fleet',
      'sys:customer',
    ]);
  });
});
