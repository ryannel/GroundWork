// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { PlanErrors } from './plan-errors';

afterEach(cleanup);

const at = { workspace: 'shop', workspaceName: 'Shop', slug: 'mini', title: null };

describe('PlanErrors', () => {
  it('says how many errors there are and where each one is', () => {
    render(
      <PlanErrors
        {...at}
        errors={[
          { path: 'services[1].team', message: 'names no team' },
          { path: 'flows[0]', message: 'has no steps' },
        ]}
        warnings={[{ path: 'risks[0]', message: 'has no owner' }]}
      />,
    );
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'This plan has 2 errors and cannot be shown yet',
    );
    const items = screen.getAllByRole('listitem').filter((li) => li.dataset.level !== undefined);
    expect(items.map((li) => li.dataset.level)).toEqual(['error', 'error', 'warning']);
    expect(screen.getByText('services[1].team')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to Shop' }).getAttribute('href')).toBe('/shop');
  });

  it('says one error in the singular and caps a long list', () => {
    const many = Array.from({ length: 70 }, (_, i) => ({ path: `p${String(i)}`, message: 'm' }));
    render(<PlanErrors {...at} errors={[many[0] ?? { path: '', message: '' }]} warnings={many} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/has 1 error and/u);
    expect(screen.getByText('And 11 more.')).toBeTruthy();
  });
});
