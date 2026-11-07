// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';

import { queryModel } from '@/../test/fixtures/model-queries';
import { packAreaMapOverview, packAreaMapView } from '@/application/area-map/transport';
import { modelAreaViewOf } from '@/application/model-area';
import { indexOf } from '@/application/model-index';
import type { ModelCite, WorkspaceModel } from '@/domain/workspace-model';

import { AreaMap } from './area-map.client';
import { AreaSystemMap } from './area-system-map.client';
import { AreaValueMap } from './area-value-map.client';

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn<() => void>();
      disconnect = vi.fn<() => void>();
    },
  );
});
afterEach(cleanup);
const cite: ModelCite = {
  kind: 'code',
  repo: 'fixture/a',
  commit: 'a'.repeat(40),
  path: 'example.ts',
};
const model: WorkspaceModel = {
  ...queryModel(),
  landscape: {
    format: 2,
    areas: [{ id: 'area:boundaries', name: 'Boundary work', purpose: 'Synthetic boundary proof.' }],
    details: [
      {
        area: 'area:boundaries',
        systems: ['sys:a'],
        relationships: [],
        collaborations: [],
        valueFlow: {
          title: 'Recorded boundaries',
          summary: 'Synthetic boundary proof.',
          confidence: 'low',
          reasoning: 'Fixture only.',
          limitations: [],
          bands: [
            {
              id: 'work',
              title: 'Recorded work',
              summary: 'Keep real boundaries.',
              nodes: [
                { component: 'svc:a', column: 0 },
                { component: 'sys:unmapped', column: 1 },
              ],
            },
          ],
          connections: [
            {
              from: 'svc:a',
              to: 'sys:unmapped',
              label: 'A known system boundary',
              kind: 'api',
              cites: [cite],
            },
            {
              from: 'svc:a',
              to: 'ext:supplier',
              label: 'A known external boundary',
              kind: 'api',
              cites: [cite],
            },
          ],
        },
      },
    ],
  },
};
const view = modelAreaViewOf(indexOf(model), 'boundaries');
if (view?.valueFlow === undefined) {
  throw new Error('Missing native boundary fixture');
}
const narrative = view.valueFlow;

it('inspects an unmapped system and external party without inventing expandable components', () => {
  render(<AreaValueMap view={view} narrative={narrative} />);
  expect(screen.queryByRole('button', { name: 'Expand Unmapped' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Expand Supplier' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Unmapped' }));
  expect(screen.getByRole('heading', { name: 'Unmapped' })).toBeTruthy();
  expect(screen.getAllByText('System boundary').length).toBeGreaterThan(0);
  expect(
    screen.getAllByText('The implementing components have not been mapped.').length,
  ).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', { name: 'Close Unmapped' }));
  fireEvent.click(screen.getByRole('button', { name: 'Supplier' }));
  expect(screen.getByRole('heading', { name: 'Supplier' })).toBeTruthy();
  expect(screen.getAllByText('External boundary').length).toBeGreaterThan(0);
  expect(
    screen.getByRole('link', { name: 'Open boundary details →' }).getAttribute('href'),
  ).toContain('ext%3Asupplier');
});
it('retains the same boundary identities in the system-structure view', () => {
  render(<AreaSystemMap view={view} />);
  expect(screen.queryByRole('button', { name: 'Expand Unmapped' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Expand Supplier' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Unmapped' }));
  expect(screen.getByRole('heading', { name: 'Unmapped' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Close Unmapped' }));
  fireEvent.click(screen.getByRole('button', { name: 'Supplier' }));
  expect(screen.getByRole('heading', { name: 'Supplier' })).toBeTruthy();
});

it('defers the full native map until the reader asks for all connections', async () => {
  const payload = packAreaMapOverview(view);
  expect(payload.valueFlow).toEqual(narrative);
  expect(payload.technicalRelationships).toEqual([]);
  expect(view.technicalRelationships.length).toBeGreaterThan(0);
  const load = vi.fn<typeof fetch>().mockResolvedValue(Response.json(packAreaMapView(view)));
  vi.stubGlobal('fetch', load);
  try {
    render(<AreaMap payload={payload} detailsHref="/area/map.json" />);
    expect(load).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'All connections' }));
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'All connections' }).getAttribute('aria-pressed'),
      ).toBe('true');
    });
    expect(load).toHaveBeenCalledExactlyOnceWith('/area/map.json', { cache: 'no-store' });
  } finally {
    vi.unstubAllGlobals();
  }
});
