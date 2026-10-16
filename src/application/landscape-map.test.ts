import { describe, expect, it } from 'vitest';

import type { LandscapeMapInput } from './landscape-map-input';
import { drawLandscape } from './landscape-map-layout';
import { pathBoxes, pathLines, rollUp, shownBy, viaLabel } from './landscape-map-rollup';

const system = (id: string) => ({
  id,
  name: id,
  does: '',
  href: `/${id}/`,
  team: null,
  teamSlot: 0,
  parts: 1,
});

const domain = (id: string, systems: string[]) => ({
  id,
  name: id,
  purpose: null,
  href: `/${id}/`,
  systems: systems.map(system),
});

const input: LandscapeMapInput = {
  actors: [{ id: 'actor:p', name: 'P', summary: null }],
  domains: [
    domain('domain:a', ['sys:a1', 'sys:a2', 'sys:a3', 'sys:a4']),
    domain('domain:b', ['sys:b1']),
    domain('domain:c', ['sys:c1']),
  ],
  externals: [{ id: 'svc:x', name: 'X', does: null, system: 'sys:c1' }],
  links: [
    { from: 'actor:p', to: 'svc:a1', kind: 'use', via: 'Start' },
    { from: 'svc:a1', to: 'svc:a2', kind: 'api', via: 'A2 API' },
    { from: 'svc:a1', to: 'svc:b1', kind: 'api', via: 'B API' },
    { from: 'svc:b1', to: 'svc:a2', kind: 'msg', via: 'b.events' },
    { from: 'svc:a2', to: 'svc:b1', kind: 'data', via: 'b-db' },
    { from: 'svc:a1', to: 'svc:c1', kind: 'msg', via: 'c.events' },
    { from: 'svc:c1', to: 'svc:x', kind: 'api', via: 'X API' },
    { from: 'svc:a1', to: 'svc:gone', kind: 'api', via: 'Lost' },
  ],
  homes: {
    'svc:a1': 'sys:a1',
    'svc:a2': 'sys:a2',
    'svc:b1': 'sys:b1',
    'svc:c1': 'sys:c1',
    'svc:x': 'sys:c1',
  },
  paths: [
    {
      key: 'k',
      title: 'K',
      kind: 'flow',
      href: '/k/',
      actor: 'actor:p',
      pairs: [['svc:a1', 'svc:b1']],
    },
    { key: 'q', title: 'Q', kind: 'flow', href: '/q/', actor: null, pairs: [] },
  ],
};

describe('rollUp', () => {
  it('shows a component by its system when its domain is open, else by the domain', () => {
    const folded = shownBy(input, new Set());
    expect(folded('svc:a1')).toBe('domain:a');
    expect(folded('sys:a1')).toBe('domain:a');
    expect(folded('svc:x')).toBe('svc:x');
    expect(folded('svc:gone')).toBeNull();
    expect(shownBy(input, new Set(['domain:a']))('svc:a1')).toBe('sys:a1');
  });

  it('merges every connection between two boxes into one line, with its kinds and ways', () => {
    const lines = rollUp(input, new Set());
    expect(lines.map((l) => l.id)).toEqual([
      'actor:p|domain:a',
      'domain:a|domain:b',
      'domain:a|domain:c',
      'domain:c|svc:x',
    ]);
    const ab = lines[1]!;
    expect(ab).toMatchObject({
      kind: 'api',
      kinds: ['api', 'msg', 'data'],
      forward: true,
      back: true,
    });
    expect(ab.label).toBe('B API, b.events and 1 more');
  });

  it('drops a line inside one box, and keeps it once the box opens', () => {
    expect(rollUp(input, new Set()).some((l) => l.id.includes('sys:a2'))).toBe(false);
    expect(rollUp(input, new Set(['domain:a'])).map((l) => l.id)).toContain('sys:a1|sys:a2');
  });

  it('names one or two ways in full', () => {
    expect(viaLabel(['A'])).toBe('A');
    expect(viaLabel(['A', 'B'])).toBe('A and B');
  });

  it('lights a path and the person who starts it', () => {
    const lines = pathLines(input, new Set(), input.paths[0]!);
    expect([...lines]).toEqual(['actor:p|domain:a', 'domain:a|domain:b']);
    expect([...pathBoxes(lines)]).toEqual(['actor:p', 'domain:a', 'domain:b']);
    expect(pathLines(input, new Set(), input.paths[1]!).size).toBe(0);
  });
});

/** Every point named in a path. */
function cornersIn(d: string): { x: number; y: number }[] {
  const n = (d.match(/-?[\d.]+/g) ?? []).map(Number);
  return n.flatMap((x, i) => (i % 2 === 0 ? [{ x, y: n[i + 1] ?? 0 }] : []));
}

describe('drawLandscape', () => {
  it('lays people over the domains and outside services under them', () => {
    const drawing = drawLandscape(input, new Set());
    const at = (id: string) => drawing.nodes.find((n) => n.id === id)!;
    expect(at('actor:p').y).toBeLessThan(at('domain:a').y);
    expect(at('svc:x').y).toBeGreaterThan(at('domain:a').y + at('domain:a').h);
    expect(at('domain:a').x).toBeLessThan(at('domain:b').x);
    expect(at('domain:a').dots).toEqual([0]);
    expect(drawing.nodes.every((n) => n.x >= 0 && n.x + n.w <= drawing.width)).toBe(true);
  });

  it('meets under the row when a box is in the way, and shares the corridor between neighbours', () => {
    const drawing = drawLandscape(input, new Set());
    const ys = (id: string) => cornersIn(drawing.lines.find((l) => l.id === id)!.d).map((p) => p.y);
    const rowBottom = Math.max(
      ...drawing.nodes.filter((n) => n.kind === 'domain').map((n) => n.y + n.h),
    );
    expect(Math.max(...ys('domain:a|domain:c'))).toBeGreaterThan(rowBottom);
    expect(Math.max(...ys('domain:a|domain:b'))).toBeLessThanOrEqual(rowBottom);
  });

  it('opens a domain into a column of its systems that no line runs through', () => {
    const drawing = drawLandscape(input, new Set(['domain:a', 'domain:b']));
    const frame = drawing.nodes.find((n) => n.id === 'domain:a')!;
    expect(frame.kind).toBe('frame');
    const cards = drawing.nodes.filter((n) => n.domain === 'domain:a');
    expect(new Set(cards.map((c) => c.x)).size).toBe(1);
    expect(cards.every((c) => c.x >= frame.x && c.y + c.h <= frame.y + frame.h)).toBe(true);
    expect(drawing.lines.map((l) => l.id)).toContain('sys:a1|sys:a2');
    const systems = drawing.nodes.filter((n) => n.kind === 'system');
    const inside = (p: { x: number; y: number }) =>
      systems.some(
        (c) => p.x > c.x + 1 && p.x < c.x + c.w - 1 && p.y > c.y + 1 && p.y < c.y + c.h - 1,
      );
    expect(drawing.lines.flatMap((l) => cornersIn(l.d)).some(inside)).toBe(false);
  });

  it('leaves room for no outside services', () => {
    const bare = drawLandscape({ ...input, externals: [], actors: [] }, new Set());
    expect(bare.nodes.some((n) => n.kind === 'external')).toBe(false);
    expect(bare.height).toBeGreaterThan(0);
  });
});
