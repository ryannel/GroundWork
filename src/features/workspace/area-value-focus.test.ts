import { describe, expect, it } from 'vitest';

import type { ValueFlowDrawing, ValueFlowNode } from '@/application/area-map/value-flow-system';

import { selectedFlowFrame } from './area-value-focus';

function node(id: string, x: number, y: number, systemId = id): ValueFlowNode {
  return {
    id,
    x,
    y,
    width: 280,
    height: 140,
    rank: 0,
    system: id,
    systemId,
    band: 'read',
    supporting: false,
    collapsed: true,
    members: [id],
    component: {
      id,
      name: id,
      kind: 'service',
      summary: '',
      endpoints: [],
      dependencies: [],
      resources: [],
      repository: null,
      explorer: null,
    },
  };
}

describe('the selected value-flow frame', () => {
  const drawing: ValueFlowDrawing = {
    width: 9000,
    height: 6000,
    headings: [],
    nodes: [
      node('graph', 1000, 470),
      node('pages', 1920, 146),
      node('marketing', 1920, 470),
      node('other-work', 8000, 5000),
    ],
  };
  const selection = {
    flow: 'understand',
    ids: new Set(['graph', 'pages', 'marketing']),
  };

  it('includes every participant, including an independent contribution, without fitting unrelated work', () => {
    const frame = selectedFlowFrame(drawing, selection, [])!;
    for (const member of drawing.nodes.slice(0, 3)) {
      expect(frame.x).toBeLessThan(member.x);
      expect(frame.y).toBeLessThan(member.y);
      expect(frame.x + frame.width).toBeGreaterThan(member.x + member.width);
      expect(frame.y + frame.height).toBeGreaterThan(member.y + member.height);
    }
    expect(frame.x + frame.width).toBeLessThan(3000);
    expect(frame.maximumZoom).toBe(1);
    expect(frame.fit).toBe(true);
  });

  it('includes a connection that travels outside its participants', () => {
    const frame = selectedFlowFrame(drawing, selection, [
      {
        points: [
          { x: 900, y: 900 },
          { x: 2250, y: 900 },
        ],
      },
    ])!;
    expect(frame.x).toBeLessThan(900);
    expect(frame.y + frame.height).toBeGreaterThan(900);
    expect(frame.x + frame.width).toBeGreaterThan(2250);
  });

  it('keeps expansion on the selected local work, not the beginning of its system', () => {
    const expanded = {
      ...drawing,
      nodes: [
        node('publish', 100, 100, 'price'),
        node('calculate', 100, 1800, 'price'),
        node('bank', 3000, 1800),
      ],
    };
    const frame = selectedFlowFrame(
      expanded,
      { flow: 'calculate', ids: new Set(['calculate', 'bank']), opened: 'price' },
      [],
    )!;
    expect(frame.y).toBeGreaterThan(1000);
    expect(frame.x + frame.width).toBeLessThan(3000);
  });

  it('does not move the default camera for an absent or empty selection', () => {
    expect(selectedFlowFrame(drawing, { flow: selection.flow }, [])).toBeUndefined();
    expect(
      selectedFlowFrame(drawing, { ...selection, ids: new Set(['missing']) }, []),
    ).toBeUndefined();
  });
});
