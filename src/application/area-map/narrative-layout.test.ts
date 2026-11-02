import { describe, expect, it } from 'vitest';

import type { SystemNarrative } from '@/domain/system-narrative';

import { layoutNarrative } from './narrative-layout';

const story: SystemNarrative = {
  id: 'inputs',
  name: 'Prepare inputs',
  summary: 'Prepare data for later use.',
  confidence: 'medium',
  reasoning: 'Recorded producers and readers.',
  limitations: [],
  stages: ['editor', 'writer', 'cache', 'reader', 'answer'].map((component) => ({
    component,
    title: component,
    summary: component,
    supporting: [`${component}-support`],
    evidence: [component],
  })),
};

describe('narrative layout', () => {
  it('preserves one row of primary components and keeps supporting cards clear', () => {
    const nodes = story.stages
      .flatMap((stage) => [
        { id: stage.component, width: 320, height: 150 },
        { id: `${stage.component}-support`, width: 320, height: 900 },
      ])
      .toReversed();
    const boxes = layoutNarrative(nodes, story);
    const primary = boxes.filter((box) => !box.id.endsWith('-support'));
    expect(primary.map((box) => box.id)).toEqual(story.stages.map((stage) => stage.component));
    expect(primary[1]!.x).toBeGreaterThan(primary[0]!.x + 320);
    expect(primary[3]!.x).toBeGreaterThan(primary[2]!.x + 320);
    expect(primary[3]!.y).toBe(primary[0]!.y);
    for (const box of boxes) {
      for (const other of boxes.filter((candidate) => candidate.id !== box.id)) {
        expect(
          box.x + box.width <= other.x ||
            other.x + other.width <= box.x ||
            box.y + box.height <= other.y ||
            other.y + other.height <= box.y,
        ).toBe(true);
      }
    }
  });

  it('does not invent cards when a reference is absent', () => {
    expect(layoutNarrative([], story)).toEqual([]);
    const nodes = [{ id: 'editor', width: 320, height: 120 }];
    expect(layoutNarrative(nodes, story).map((box) => box.id)).toEqual(['editor']);
  });
});
