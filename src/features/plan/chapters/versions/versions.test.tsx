// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { bodiesIn } from '@/features/plan/chapters/chapter-kit';
import { VersionsChapter } from '@/features/plan/chapters/versions/versions-chapter';

vi.mock('server-only', () => ({}));

const { planData } = await import('@/infrastructure/plan-data');
const { planRevision } = await import('@/infrastructure/plan-revision');

async function bodiesOf(plan: string) {
  const data = await planData({ workspace: 'alder-finch', plan });
  return bodiesIn(data, 'versions', await planRevision('alder-finch', plan));
}

afterEach(cleanup);

describe('versions chapter', () => {
  it.each(['invoice-vat-number', 'stock-reservation'])(
    'draws every screen of %s with a headline',
    async (plan) => {
      const bodies = await bodiesOf(plan);
      expect(bodies.length).toBeGreaterThan(1);
      for (const props of bodies) {
        const { container, unmount } = render(<VersionsChapter {...props} />);
        expect(container.querySelector('h1 + div, h2 + div')?.textContent).not.toBe('');
        unmount();
      }
    },
  );

  it('lists every version on the history screen, each linking to its page', async () => {
    const bodies = await bodiesOf('stock-reservation');
    const history = bodies.find((p) => p.page.screen === 'history');
    if (history === undefined) throw new Error('no history');
    const { container } = render(<VersionsChapter {...history} />);
    const links = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(links).toHaveLength(bodies.length - 1);
    expect(links.every((href) => href?.includes('/versions/v') === true)).toBe(true);
  });

  it('folds the edits of a version page away', async () => {
    const bodies = await bodiesOf('invoice-vat-number');
    const folded = bodies
      .filter((p) => p.page.screen !== 'history')
      .map((p) => render(<VersionsChapter {...p} />))
      .filter(({ container }) => container.querySelector('details') !== null);
    expect(folded.length).toBeGreaterThan(0);
  });

  it('says what the proposed version asks and what it changes', async () => {
    const bodies = await bodiesOf('invoice-vat-number');
    const page = bodies.find((p) => p.page.screen === 'v1.2');
    if (page === undefined) throw new Error('no v1.2');
    const { container } = render(<VersionsChapter {...page} />);
    const text = container.textContent;
    expect(text).toContain('Check before deciding');
    expect(text).toContain('What it changes');
    expect(text).toContain('Work and teams');
  });

  it('says why a rejected version was rejected', async () => {
    const bodies = await bodiesOf('invoice-vat-number');
    const page = bodies.find((p) => p.page.screen === 'v1.1');
    if (page === undefined) throw new Error('no v1.1');
    const { container } = render(<VersionsChapter {...page} />);
    expect(container.textContent).toContain('Rejected');
    expect(container.textContent).toContain('What it would have changed');
  });

  it('draws nothing when the plan has no ledger', () => {
    const { container } = render(
      <VersionsChapter
        model={undefined as never}
        outline={undefined as never}
        page={undefined as never}
        versions={null}
      />,
    );
    expect(container.innerHTML).toBe('');
  });
});
