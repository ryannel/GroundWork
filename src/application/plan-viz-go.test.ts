import { describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';
import { outlineOf } from '@/application/plan-pages';

import { ladderPage } from './plan-viz-go';

vi.mock('server-only', () => ({}));

const { readPlan } = await import('@/infrastructure/plan-store');
const { loadFixture } = await import('@/infrastructure/plan-fixture');

describe('ladderPage', () => {
  it('points at the contracts page of the changes chapter, numbered as the rail numbers it', async () => {
    const loaded = await readPlan('alder-finch', 'delivery-promise');
    const outline = outlineOf(derive(loaded.plan!), {
      workspace: 'alder-finch',
      slug: 'delivery-promise',
    });
    const changes = outline.chapters.find((c) => c.key === 'changes');
    const index = changes?.pages.findIndex((p) => p.screen === 'contracts') ?? -1;
    expect(index).toBeGreaterThanOrEqual(0);
    expect(ladderPage(outline)).toEqual({
      href: '/alder-finch/plans/delivery-promise/changes/contracts/',
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
