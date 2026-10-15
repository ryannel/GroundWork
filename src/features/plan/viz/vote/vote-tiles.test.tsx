// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';
import { voteSummary, voteText, voteTileList } from '@/application/plan-viz-vote';
import { VoteTiles } from '@/features/plan/viz/vote/vote-tiles';

vi.mock('server-only', () => ({}));

afterEach(cleanup);

async function voted() {
  const { readPlan } = await import('@/infrastructure/plan-store');
  const loaded = await readPlan('alder-finch', 'delivery-promise');
  const plan = loaded.plan!;
  const [a, b, c] = plan.work_items!.map((w) => w.team).filter((t, i, all) => all.indexOf(t) === i);
  const model = derive({
    ...plan,
    commitment: [
      { team: b!, confidence: 5 },
      { team: a!, confidence: 2, note: 'Too much for one sprint.' },
    ],
  });
  return { model, low: a!, high: b!, silent: c! };
}

describe('vote', () => {
  it('sums who voted, who rated low and who has not yet', async () => {
    const { model, low, high, silent } = await voted();
    const s = voteSummary(model);
    expect(s.cast).toEqual(expect.arrayContaining([low, high]));
    expect(s.low).toEqual([low]);
    expect(s.missing).toContain(silent);
    expect(voteText(model, high)).toBe('5 of 5');
    expect(voteText(model, silent)).toBe('not yet');
    expect(voteText(model, 'team:nobody')).toBe('');
  });

  it('leads with a low vote', async () => {
    const { model, low, high } = await voted();
    expect(voteTileList(model, [high, low]).map((t) => t.team)).toEqual([low, high]);
  });

  it('draws a tile per team with the score, pips and note', async () => {
    const { model, low, silent } = await voted();
    const { container } = render(<VoteTiles before="v2" model={model} stale={[low]} />);
    const tiles = container.querySelectorAll('article');
    expect(tiles).toHaveLength(voteSummary(model).teams.length);
    expect(tiles[0]?.hasAttribute('data-low')).toBe(true);
    expect(tiles[0]?.textContent).toContain('2 of 5');
    expect(tiles[0]?.textContent).toContain('Too much for one sprint.');
    expect(tiles[0]?.textContent).toContain('rated before v2');
    expect(container.querySelectorAll('article[data-missing]').length).toBeGreaterThan(0);
    expect(container.textContent).toContain('Not rated yet.');
    expect(container.querySelector(`button[data-inspect="${silent}"]`)).not.toBeNull();
  });

  it('shows only the teams it is given', async () => {
    const { model, high } = await voted();
    const { container } = render(<VoteTiles model={model} teams={[high]} />);
    expect(container.querySelectorAll('article')).toHaveLength(1);
  });
});
