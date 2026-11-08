import { expect, it } from 'vitest';

import { archiveHref } from './interpretation-archive';

it('links to a historical interpretation at its recorded repository and revision', () => {
  const scope = { repo: 'acme/orders', commit: 'recorded' };
  expect(archiveHref('acme', scope)).toBe('/acme/evidence/?repo=acme%2Forders&commit=recorded');
  expect(archiveHref('acme', scope, 'claim:reviewed#one')).toBe(
    '/acme/evidence/?repo=acme%2Forders&commit=recorded#claim%3Areviewed%23one',
  );
});
