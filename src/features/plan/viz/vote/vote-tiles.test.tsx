// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { dispatchDate } from '@/../test/fixtures/acme/plans/work-dispatch';
import { modelOf } from '@/../test/plan-kit';
import { voteSummary, voteText, voteTileList } from '@/application/plan-viz-vote';
import { VoteTiles } from '@/features/plan/viz/vote/vote-tiles';

afterEach(cleanup);

function voted() {
  const model = modelOf({
    ...dispatchDate(),
    commitment: [
      { team: 'team:orders', confidence: 5 },
      { team: 'team:catalogue', confidence: 2, note: 'Too much for one sprint.' },
    ],
  });
  return { model, low: 'team:catalogue', high: 'team:orders', silent: 'team:web' };
}

describe('vote', () => {
  it('sums who voted, who rated low and who has not yet', () => {
    const { model, low, high, silent } = voted();
    const s = voteSummary(model);
    expect(s.cast.toSorted((a, b) => a.localeCompare(b))).toEqual([low, high]);
    expect(s.low).toEqual([low]);
    expect(s.missing).toContain(silent);
    expect(s.teams).toEqual(['team:web', 'team:orders', 'team:catalogue']);
    expect(voteText(model, high)).toBe('5 of 5');
    expect(voteText(model, silent)).toBe('not yet');
    expect(voteText(model, 'team:nobody')).toBe('');
  });

  it('leads with a low vote', () => {
    const { model, low, high } = voted();
    expect(voteTileList(model, [high, low]).map((t) => t.team)).toEqual([low, high]);
  });

  it('draws a tile per team with the score, pips and note', () => {
    const { model, low, silent } = voted();
    const { container } = render(<VoteTiles before="v2" model={model} stale={[low]} />);
    const tiles = container.querySelectorAll('article');
    expect(tiles).toHaveLength(voteSummary(model).teams.length);
    expect(tiles[0]?.hasAttribute('data-low')).toBe(true);
    expect(tiles[0]?.textContent).toContain('2 of 5');
    expect(tiles[0]?.textContent).toContain('Too much for one sprint.');
    expect(tiles[0]?.textContent).toContain('rated before v2');
    expect(container.querySelectorAll('article[data-missing]')).toHaveLength(1);
    expect(container.textContent).toContain('Not rated yet.');
    expect(container.querySelector(`button[data-inspect="${silent}"]`)).not.toBeNull();
  });

  it('shows only the teams it is given', () => {
    const { model, high } = voted();
    const { container } = render(<VoteTiles model={model} teams={[high]} />);
    expect(container.querySelectorAll('article')).toHaveLength(1);
  });
});
