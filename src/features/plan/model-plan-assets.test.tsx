// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';

import { ModelPlanAssets } from './model-plan-assets';

afterEach(cleanup);
it('draws all recorded picture, design, region and label fields using the supplied proven address', () => {
  render(
    <ModelPlanAssets
      assets={[
        {
          file: 'assets/current.png',
          href: '/queries/assets/current.png',
          figma: 'https://figma.test/current',
          region: 'scr:current#panel',
          label: 'The recorded screen',
          gap: null,
        },
      ]}
    />,
  );
  expect(screen.getByRole('img', { name: 'The recorded screen' }).getAttribute('src')).toBe(
    '/queries/assets/current.png',
  );
  expect(screen.getByRole('link', { name: 'assets/current.png' }).getAttribute('href')).toBe(
    '/queries/assets/current.png',
  );
  expect(screen.getByRole('link', { name: 'Open in Figma' }).getAttribute('href')).toBe(
    'https://figma.test/current',
  );
  expect(screen.getByText('Region: scr:current#panel')).toBeTruthy();
});
it('keeps an unknown relative origin visible without inventing a picture address', () => {
  render(
    <ModelPlanAssets
      assets={[
        {
          file: 'assets/ancestor.png',
          href: null,
          figma: null,
          region: null,
          label: 'Ancestor picture',
          gap: 'The ancestor asset location is not established.',
        },
      ]}
    />,
  );
  expect(screen.getByText('The ancestor asset location is not established.')).toBeTruthy();
  expect(screen.getByText('assets/ancestor.png')).toBeTruthy();
  expect(screen.queryByRole('img')).toBeNull();
  expect(screen.queryByRole('link')).toBeNull();
});
it('retains a design-only asset without an invented file or duplicate source link', () => {
  render(
    <ModelPlanAssets
      assets={[
        {
          file: null,
          href: 'https://figma.test/only',
          figma: 'https://figma.test/only',
          region: null,
          label: null,
          gap: null,
        },
      ]}
    />,
  );
  expect(screen.getByRole('link', { name: 'Design source' }).getAttribute('href')).toBe(
    'https://figma.test/only',
  );
  expect(screen.getAllByRole('link')).toHaveLength(1);
  expect(screen.queryByRole('img')).toBeNull();
});
