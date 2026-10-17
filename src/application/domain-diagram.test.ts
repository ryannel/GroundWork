import { describe, expect, it } from 'vitest';

import { acme } from '@/../test/workspace-kit';

import { domainDiagramOf } from './domain-diagram';
import { layDiagram } from './domain-diagram-layout';

const box = (id: string) => ({ id, name: id, does: '', href: null, slot: 0 });

describe('domainDiagramOf', () => {
  it('draws the domain’s systems, their neighbours, and one counted line per pair', () => {
    const { workspace, today } = acme();
    const diagram = domainDiagramOf(workspace, today.model, 'storefront');
    const of = (kind: string) => diagram.boxes.filter((b) => b.kind === kind).map((b) => b.id);
    expect(of('here').toSorted((a, b) => a.localeCompare(b))).toEqual(['sys:accounts', 'sys:shop']);
    expect(of('outside')).toEqual(['sys:ordering']);
    expect(of('actor')).toEqual(['actor:customer']);
    expect(diagram.lines.map((l) => [l.id, l.label])).toEqual([
      ['actor:customer>sys:shop', ''],
      ['sys:shop>sys:ordering', '1 call'],
    ]);
    const ids = new Set(diagram.boxes.map((b) => b.id));
    expect(diagram.lines.every((l) => ids.has(l.from) && ids.has(l.to))).toBe(true);
  });

  it('draws nothing but empty space for a domain the workspace does not have', () => {
    const { workspace, today } = acme();
    expect(domainDiagramOf(workspace, today.model, 'nowhere').boxes).toEqual([]);
  });
});

describe('layDiagram', () => {
  it('puts callers on the left, the domain in the order work moves, and what it calls on the right', () => {
    const diagram = layDiagram({
      actors: [box('person')],
      here: [box('a'), box('b'), box('c')],
      outside: [box('in'), box('out')],
      links: [
        { from: 'person', to: 'a', label: '' },
        { from: 'in', to: 'a', label: '1 call' },
        { from: 'a', to: 'b', label: '1 call' },
        { from: 'b', to: 'c', label: '1 event' },
        { from: 'c', to: 'a', label: '1 call' },
        { from: 'c', to: 'out', label: '1 call' },
      ],
    });
    const x = (id: string) => diagram.boxes.find((b) => b.id === id)?.x ?? -1;
    expect(x('person')).toBe(0);
    expect(x('in')).toBe(0);
    expect(x('a')).toBeLessThan(x('b'));
    expect(x('b')).toBeLessThan(x('c'));
    expect(x('out')).toBeGreaterThan(x('c'));
    const back = diagram.lines.find((l) => l.id === 'c>a');
    expect(back?.d.startsWith(`M${String(x('c'))},`)).toBe(true);
    expect(diagram.w).toBeGreaterThan(x('out'));
  });

  it('closes up empty columns and runs a line between boxes in one column round their right side', () => {
    const diagram = layDiagram({
      actors: [],
      here: [box('a'), box('b')],
      outside: [box('x')],
      links: [
        { from: 'x', to: 'a', label: '' },
        { from: 'a', to: 'x', label: '' },
        { from: 'b', to: 'missing', label: '' },
      ],
    });
    expect(Math.min(...diagram.boxes.map((b) => b.x))).toBe(0);
    expect(diagram.lines).toHaveLength(2);
    expect(diagram.boxes.find((b) => b.id === 'b')?.y).toBeGreaterThan(-1);
  });

  it('draws nothing for an empty domain', () => {
    expect(layDiagram({ actors: [], here: [], outside: [], links: [] }).boxes).toEqual([]);
  });
});
