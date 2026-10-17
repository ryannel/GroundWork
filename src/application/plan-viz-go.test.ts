import { describe, expect, it, vi } from 'vitest';

import { shopGraph } from '@/../test/fixtures/journeys-shop-graph';
import { modelOf } from '@/../test/plan-kit';
import { derive } from '@/application/plan/derive';
import { outlineOf } from '@/application/plan-pages';

import { ladderPage } from './plan-viz-go';

vi.mock(import('server-only'), () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');

describe('ladderPage', () => {
  it('points at the contracts page of the changes chapter, numbered as the rail numbers it', () => {
    const outline = outlineOf(modelOf(shopGraph()), {
      workspace: 'acme',
      slug: 'shop',
    });
    const changes = outline.chapters.find((c) => c.key === 'changes');
    const index = changes?.pages.findIndex((p) => p.screen === 'contracts') ?? -1;
    expect(index).toBeGreaterThanOrEqual(0);
    expect(ladderPage(outline)).toEqual({
      href: '/acme/plans/shop/changes/contracts/',
      label: `See the ladder (4.${String(index + 1)})`,
    });
  });

  it('is null when nothing is retired', async () => {
    const outline = outlineOf(derive(await loadFixture('mini.yaml')), {
      workspace: 'w',
      slug: 'p',
    });
    const hasContracts = outline.pages.some(
      (p) => p.chapter === 'changes' && p.screen === 'contracts',
    );
    expect(ladderPage(outline) === null).toBe(!hasContracts);
  });
});
