import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { systemModelOf } from '@/application/workspace-model';
import { findWorkspace } from '@/application/workspace-paths';
import { readWorkspaceModel } from '@/infrastructure/workspace-model';
import { readWorkspaces } from '@/infrastructure/workspace-store';

import { domainDiagramOf } from './domain-diagram';
import { layDiagram } from './domain-diagram-layout';

vi.mock('server-only', () => ({}));

const root = path.resolve(import.meta.dirname, '../../workspaces');

const box = (id: string) => ({ id, name: id, does: '', href: null, slot: 0 });

describe('domainDiagramOf', () => {
  it('draws the domain’s systems, their neighbours, and one counted line per pair', async () => {
    const workspace = findWorkspace(await readWorkspaces(root), 'alder-finch')!;
    const model = systemModelOf(workspace, await readWorkspaceModel(workspace, root)).model;
    const diagram = domainDiagramOf(workspace, model, 'order-to-delivery');
    const here = diagram.boxes.filter((b) => b.kind === 'here');
    expect(here).toHaveLength(6);
    expect(diagram.boxes.some((b) => b.kind === 'outside')).toBe(true);
    expect(diagram.lines.length).toBeGreaterThan(0);
    expect(diagram.lines.some((l) => /^\d+ (call|event|store)/.test(l.label))).toBe(true);
    const ids = new Set(diagram.boxes.map((b) => b.id));
    expect(diagram.lines.every((l) => ids.has(l.from) && ids.has(l.to))).toBe(true);
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
