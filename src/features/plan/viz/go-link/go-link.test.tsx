// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { GoLink } from './go-link';

afterEach(cleanup);

describe('GoLink', () => {
  it('is a link that says Open page unless told otherwise', () => {
    render(<GoLink href="/w/plans/p/changes/flows/" title="Open plan page 4.1" />);
    const link = screen.getByRole('link', { name: 'Open page' });
    expect(link.getAttribute('href')).toContain('/w/plans/p/changes/flows');
    expect(link.getAttribute('title')).toBe('Open plan page 4.1');
  });

  it('takes its own words', () => {
    render(<GoLink href="/x/" label="See the ladder (4.2)" />);
    expect(screen.getByRole('link').textContent).toBe('See the ladder (4.2)');
  });
});
