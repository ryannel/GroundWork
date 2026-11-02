import { describe, expect, it } from 'vitest';

import { acme } from '@/../test/workspace-kit';

import { targetViewOf } from './workspace-target';
import { CARD_W, type FlowStageIn, targetFlowOf } from './workspace-target-flow';
import { gridOf, loopsOf, TRUNK } from './workspace-target-flow-grid';

const stage = (
  id: string,
  from: readonly string[] = [],
  place: string | null = null,
): FlowStageIn => ({
  id,
  name: id,
  from,
  owners: [{ id: `sys:${id}`, label: id, glyph: 'sys', mono: false, place }],
});

// Commercial Backbone's shape: two supply lanes and a stage from nowhere, meeting at the offer.
const backbone = [
  stage('merchandise', [], 'Outside the company'),
  stage('rules', ['merchandise']),
  stage('product', ['merchandise']),
  stage('content', ['product']),
  stage('financial-product'),
  stage('financial-offer', ['financial-product']),
  stage('incentive'),
  stage('offer', ['product', 'rules', 'financial-offer', 'incentive']),
  stage('channel', ['offer', 'content']),
  stage('order', ['channel']),
];

const columnsOf = (stages: readonly FlowStageIn[]) => {
  const { col } = gridOf(stages);
  const ids = [...col.keys()];
  return [0, 1, 2, 3, 4].map((c) => ids.filter((id) => col.get(id) === c));
};

describe('where each stage of a target sits', () => {
  it('puts each stage just before the first one it feeds, so lanes meet where they are used', () => {
    expect(columnsOf(backbone)).toEqual([
      ['merchandise', 'financial-product'],
      ['rules', 'product', 'financial-offer', 'incentive'],
      ['content', 'offer'],
      ['channel'],
      ['order'],
    ]);
  });

  it('keeps each supply chain in its own lane and makes the offer, where they meet, the hub', () => {
    const { lane, hubs } = gridOf(backbone);
    expect(['merchandise', 'rules', 'product', 'content'].map((id) => lane.get(id))).toEqual([
      0, 0, 0, 0,
    ]);
    expect(['financial-product', 'financial-offer'].map((id) => lane.get(id))).toEqual([1, 1]);
    expect(lane.get('incentive')).toBe(2);
    expect(['offer', 'channel', 'order'].map((id) => lane.get(id))).toEqual([TRUNK, TRUNK, TRUNK]);
    expect([...hubs]).toEqual(['offer']);
  });

  it('does not hang on a loop, and draws no line that runs backwards', () => {
    const loop = [stage('a', ['b']), stage('b', ['a']), stage('c', ['b'])];
    expect(gridOf(loop).col.size).toBe(3);
    expect(loopsOf(loop)).toEqual(['a', 'b']);
    const flow = targetFlowOf(loop);
    expect(flow.cards).toHaveLength(3);
    const x = new Map(flow.cards.map((card) => [card.id, card.x]));
    for (const line of flow.lines) expect(x.get(line.to)!).toBeGreaterThan(x.get(line.from)!);
  });
});

describe('a target drawn as a flow', () => {
  it('draws one card for each stage and a line for each stage it feeds, left to right', () => {
    const flow = targetViewOf(acme().today, 'orders')!.flow;
    const [order, payment] = flow.cards;
    expect(flow.cards.map((card) => card.id)).toEqual(['order', 'payment']);
    expect(payment!.x).toBeGreaterThan(order!.x + CARD_W);
    expect(flow.lines.map((line) => [line.from, line.to])).toEqual([['order', 'payment']]);
    expect(flow.w).toBeGreaterThanOrEqual(payment!.x + CARD_W);
  });

  it('never lets two cards in a column overlap, and says once where a stage lives when it is all elsewhere', () => {
    const flow = targetFlowOf(backbone);
    for (const a of flow.cards) {
      const overlapping = flow.cards.filter(
        (b) => b !== a && b.x === a.x && b.y < a.y + a.h && a.y < b.y + b.h,
      );
      expect(
        overlapping.map((b) => b.id),
        a.id,
      ).toEqual([]);
    }
    const merchandise = flow.cards.find((card) => card.id === 'merchandise')!;
    expect(merchandise.outside).toBe('Outside the company');
    expect(merchandise.owners[0]!.place).toBeNull();
    expect(flow.cards.find((card) => card.id === 'offer')!.hub).toBe(true);
    expect(flow.lines).toHaveLength(11);
  });

  it('runs a line that skips a column through a gap, not through the cards in it', () => {
    const flow = targetFlowOf([stage('a'), stage('b', ['a']), stage('c', ['a', 'b'])]);
    const b = flow.cards.find((card) => card.id === 'b')!;
    const skip = flow.lines.find((line) => line.from === 'a' && line.to === 'c')!;
    const level = /L[\d.]+,([\d.]+)/u.exec(skip.d);
    const y = Number(level?.[1]);
    expect(y <= b.y || y >= b.y + b.h, `${String(y)} is inside ${String(b.y)}+${String(b.h)}`).toBe(
      true,
    );
  });

  it('lists the cards in reading order, column by column from the top', () => {
    const flow = targetFlowOf(backbone);
    const sorted = flow.cards.toSorted((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
    expect(flow.cards.map((card) => card.id)).toEqual(sorted.map((card) => card.id));
  });
});
