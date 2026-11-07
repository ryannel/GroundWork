// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';

import { modelPlanProgressOf } from '@/application/model-progress';

import { ModelPlanProgressFeed } from './model-plan-progress';
import { ModelPlanValue } from './model-plan-record';

afterEach(cleanup);
it('retains default native mentions while workspace work can link metadata into its own plan context', () => {
  const value = { id: 'wi:one', body: 'See [[wi:one]].' };
  const { unmount } = render(
    <ModelPlanValue value={value} lookup={{ labelOf: () => 'Chosen work' }} />,
  );
  expect(screen.getAllByRole('button', { name: 'Chosen work' })).toHaveLength(2);
  expect(screen.queryByRole('link')).toBeNull();
  unmount();
  render(
    <ModelPlanValue
      value={value}
      lookup={{
        labelOf: () => 'Chosen work',
        hrefOf: (id) =>
          id === 'wi:one' ? '/queries/plans/actual-folder/things/?id=wi%3Aone' : null,
      }}
    />,
  );
  expect(
    screen
      .getAllByRole('link', { name: 'Chosen work' })
      .every(
        (link) => link.getAttribute('href') === '/queries/plans/actual-folder/things?id=wi%3Aone',
      ),
  ).toBe(true);
  expect(screen.queryByRole('button', { name: 'Chosen work' })).toBeNull();
});

it('keeps scoped plan links in progress prose without changing default mentions', () => {
  const progress = modelPlanProgressOf({
    progress: {
      events: [{ kind: 'note', subject: 'wi:one', at: '2026-11-07', note: 'See [[wi:one]].' }],
    },
    errors: [],
  });
  const { unmount } = render(
    <ModelPlanProgressFeed progress={progress} labelOf={() => 'Chosen work'} />,
  );
  expect(screen.getAllByRole('button', { name: 'Chosen work' }).length).toBeGreaterThan(0);
  unmount();
  render(
    <ModelPlanProgressFeed
      progress={progress}
      labelOf={() => 'Chosen work'}
      hrefOf={() => '/queries/plans/first/things/?id=wi-one'}
    />,
  );
  expect(
    screen
      .getAllByRole('link', { name: 'Chosen work' })
      .every((link) => link.getAttribute('href') === '/queries/plans/first/things?id=wi-one'),
  ).toBe(true);
  expect(screen.queryByRole('button', { name: 'Chosen work' })).toBeNull();
});
