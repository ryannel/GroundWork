// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { packAreaMapOverview, packAreaMapView } from '@/application/area-map/transport';
import type { AreaComponentView, AreaView } from '@/application/workspace-area';
import type { LandscapeValueFlow } from '@/domain/landscape';

import { AreaMap } from './area-map.client';
import { AreaValueMap } from './area-value-map.client';

const component = (id: string, name: string): AreaComponentView => ({
  id,
  name,
  kind: 'service',
  summary: name,
  endpoints: [],
  dependencies: [],
  resources: [],
  repository: null,
  explorer: null,
});
const view: AreaView = {
  workspace: { id: 'test', name: 'Test', href: '/' },
  area: {
    id: 'commercial',
    name: 'Commercial',
    purpose: '',
    activities: [],
    boundary: '',
    confidence: 'medium',
    evidenceCount: 0,
  },
  reviewed: '2026-10-29',
  scope: '',
  limitation: '',
  relationships: [],
  technicalRelationships: [],
  collaborations: [],
  systems: [
    {
      id: 'source',
      name: 'Source',
      components: [
        component('editor', 'Editor'),
        component('topic', 'Change topic'),
        component('cache', 'Input cache'),
      ],
    },
    { id: 'consumer', name: 'Consumer', components: [component('reader', 'Reader')] },
  ].map((system) => ({ ...system, href: '/', purpose: '', resources: [] })),
};
const narrative: LandscapeValueFlow = {
  title: 'Inputs to use',
  summary: 'Publish then read.',
  confidence: 'medium',
  reasoning: 'Evidence.',
  limitations: [],
  bands: [
    {
      id: 'publish',
      title: 'Publish inputs',
      summary: 'Publish.',
      nodes: [
        { component: 'editor', column: 0 },
        { component: 'topic', column: 1 },
      ],
    },
    {
      id: 'read',
      title: 'Read inputs',
      summary: 'Read.',
      nodes: [{ component: 'reader', column: 2 }],
    },
  ],
  connections: [
    { from: 'editor', to: 'topic', label: 'Publish changes', kind: 'message', evidence: ['topic'] },
    { from: 'topic', to: 'reader', label: 'Deliver changes', kind: 'message', evidence: ['topic'] },
  ],
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('value flow exploration controls', () => {
  it.each([false, true])(
    'reveals a shared resource in a collapsed system (embedded: %s)',
    (embedded) => {
      const shared: AreaView = {
        ...view,
        systems: view.systems.map((system) => ({
          ...system,
          components:
            system.id === 'source'
              ? [
                  {
                    ...component('editor', 'Editor'),
                    resources: [{ id: 'cache', name: 'Input cache', kind: 'store', use: 'Reads' }],
                  },
                  component('topic', 'Change topic'),
                ]
              : [
                  component('reader', 'Reader'),
                  {
                    ...component('cache', 'Input cache'),
                    kind: 'database',
                    ...(embedded ? { parentComponent: 'reader' } : {}),
                  },
                ],
        })),
        technicalRelationships: [
          {
            id: 'read-cache',
            from: 'editor',
            to: 'cache',
            fromSystem: 'source',
            toSystem: 'consumer',
            via: 'cache',
            label: 'Reads inputs',
            kind: 'data',
            detail: 'Editor reads the input cache.',
            evidenced: true,
          },
        ],
      };
      const { container } = render(<AreaValueMap view={shared} narrative={narrative} />);
      fireEvent.click(screen.getByRole('button', { name: 'Source' }));
      fireEvent.click(screen.getByRole('button', { name: /Show what Editor holds/u }));
      expect(screen.getByText('Consumer · System collapsed')).toBeTruthy();
      fireEvent.change(screen.getByRole('combobox', { name: 'Follow a value flow' }), {
        target: { value: 'publish' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Only this flow' }));
      fireEvent.click(screen.getByRole('button', { name: /Input cache.*expands system/u }));
      expect(screen.getByRole('button', { name: 'Collapse Consumer' })).toBeTruthy();
      expect(screen.getByRole('heading', { name: 'Input cache' })).toBeTruthy();
      const target = container.querySelector(`[data-component="${embedded ? 'reader' : 'cache'}"]`);
      expect(target).not.toBeNull();
      expect(
        container.querySelector('[data-component="reader"] button[aria-pressed="true"]') !== null,
      ).toBe(embedded);
      expect(screen.queryAllByRole('button', { name: /Hide what Reader holds/u })).toHaveLength(
        Number(embedded),
      );
      expect(container.querySelector('[data-edge][data-kind="data"]')).not.toBeNull();
      expect(screen.queryByText('Consumer · System collapsed')).toBeNull();
      expect(screen.getByText('Consumer · Show on map')).toBeTruthy();
    },
  );

  it('explains an unplaced shared resource without offering a broken map jump', () => {
    const shared: AreaView = {
      ...view,
      systems: view.systems.map((system) => ({
        ...system,
        components: system.components.map((item) =>
          item.id === 'editor'
            ? {
                ...item,
                resources: [
                  { id: 'outside', name: 'Outside topic', kind: 'topic', use: 'Consumes' },
                ],
              }
            : item,
        ),
      })),
    };
    render(<AreaValueMap view={shared} narrative={narrative} />);
    fireEvent.click(screen.getByRole('button', { name: 'Source' }));
    fireEvent.click(screen.getByRole('button', { name: /Show what Editor holds/u }));
    expect(screen.getByText('Not placed on this map')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Outside topic/u })).toHaveProperty('disabled', true);
  });

  it('highlights a chosen flow in place and reframes only when Fit flow is requested', () => {
    render(<AreaValueMap view={view} narrative={narrative} />);
    const navigation = screen.getByLabelText('Diagram navigation');
    const before = navigation.textContent;
    fireEvent.change(screen.getByRole('combobox', { name: 'Follow a value flow' }), {
      target: { value: 'read' },
    });
    expect(navigation.textContent).toBe(before);
    expect(screen.getByText(/Highlighted systems: Consumer/u)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Fit flow' }));
    expect(navigation.textContent).not.toBe(before);
    fireEvent.click(screen.getByRole('button', { name: 'Reset canvas view' }));
    expect(navigation.textContent).toBe(before);
  });
  it('does not reopen a system after Reset cancels a pending exploration', async () => {
    const full = { ...view, valueFlow: narrative };
    const pending = Promise.withResolvers<Response>();
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockReturnValue(pending.promise));
    render(<AreaMap payload={packAreaMapOverview(full)} detailsHref="/area/map.json" />);
    fireEvent.click(screen.getByRole('button', { name: 'Source' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset canvas view' }));
    pending.resolve(Response.json(packAreaMapView(full)));
    await waitFor(() => {
      expect(screen.queryByText('Loading system details…')).toBeNull();
    });
    expect(screen.getByRole('button', { name: 'Source' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Editor' })).toBeNull();
  });

  it('uses refreshed model data after details were loaded for the same area', async () => {
    const full = { ...view, valueFlow: narrative };
    const refreshed = { ...full, valueFlow: { ...narrative, title: 'Updated prepared flow' } };
    const read = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(packAreaMapView(full)))
      .mockResolvedValueOnce(Response.json(packAreaMapView(refreshed)));
    vi.stubGlobal('fetch', read);
    const rendered = render(
      <AreaMap payload={packAreaMapOverview(full)} detailsHref="/area/map.json" />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Source' }));
    await expect(screen.findByRole('button', { name: 'Editor' })).resolves.toBeTruthy();
    rendered.rerender(
      <AreaMap payload={packAreaMapOverview(refreshed)} detailsHref="/area/map.json" />,
    );
    expect(screen.getByText('Updated prepared flow')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Editor' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Source' }));
    await expect(screen.findByRole('button', { name: 'Editor' })).resolves.toBeTruthy();
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('loads full contracts only on exploration and reuses the successful read', async () => {
    const full = { ...view, valueFlow: narrative };
    const pending = Promise.withResolvers<Response>();
    const read = vi.fn<typeof fetch>().mockReturnValue(pending.promise);
    vi.stubGlobal('fetch', read);
    render(<AreaMap payload={packAreaMapOverview(full)} detailsHref="/area/map.json" />);
    expect(read).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Source' }));
    expect(screen.getByText('Loading system details…')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Editor' })).toBeNull();
    pending.resolve(Response.json(packAreaMapView(full)));
    await expect(screen.findByRole('button', { name: 'Editor' })).resolves.toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Collapse Source' }));
    fireEvent.click(screen.getByRole('button', { name: 'Source' }));
    await expect(screen.findByRole('button', { name: 'Editor' })).resolves.toBeTruthy();
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('keeps the overview available after a failed detail read and retries on the next selection', async () => {
    const full = { ...view, valueFlow: narrative };
    const read = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(Response.json(packAreaMapView(full)));
    vi.stubGlobal('fetch', read);
    render(<AreaMap payload={packAreaMapOverview(full)} detailsHref="/area/map.json" />);
    fireEvent.click(screen.getByRole('button', { name: 'Source' }));
    await expect(
      screen.findByText('Could not load system details. Select the system to try again.'),
    ).resolves.toBeTruthy();
    expect(screen.getByRole('button', { name: 'Consumer' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Source' }));
    await expect(screen.findByRole('button', { name: 'Editor' })).resolves.toBeTruthy();
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('starts collapsed, expands one system and retains its supporting components', () => {
    render(<AreaValueMap view={view} narrative={narrative} />);
    expect(screen.queryByRole('button', { name: 'Editor' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Source' }));
    expect(screen.getByRole('button', { name: 'Editor' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Change topic' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Input cache' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Consumer' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Reader' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Collapse Source' }));
    expect(screen.getByRole('button', { name: 'Source' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Editor' })).toBeNull();
  });
  it('opens a linked secondary flow without expanding or filtering out its context', () => {
    const { container } = render(
      <AreaValueMap view={view} narrative={narrative} initialFlow="read" />,
    );
    expect(
      screen.getByRole<HTMLSelectElement>('combobox', { name: 'Follow a value flow' }).value,
    ).toBe('read');
    expect(container.querySelectorAll('[data-component]')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Reader' })).toBeNull();
    expect(container.querySelectorAll('[data-component][data-flow]')).toHaveLength(1);
    expect(container.querySelector('[data-edge]:not([data-context])')).toBeNull();
    expect(screen.getByText(/Highlighted systems: Consumer/u)).toBeTruthy();
    fireEvent.change(screen.getByRole('combobox', { name: 'Follow a value flow' }), {
      target: { value: 'publish' },
    });
    expect(new URL(globalThis.location.href).searchParams.get('flow')).toBe('publish');
    fireEvent.click(screen.getByRole('button', { name: 'Reset canvas view' }));
    expect(new URL(globalThis.location.href).searchParams.has('flow')).toBe(false);
  });
  it('filters without leaving a line to a hidden system', () => {
    const { container } = render(<AreaValueMap view={view} narrative={narrative} />);
    fireEvent.click(screen.getByRole('button', { name: 'Source' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Follow a value flow' }), {
      target: { value: 'publish' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Only this flow' }));
    expect(screen.queryByRole('button', { name: 'Consumer' })).toBeNull();
    expect(container.querySelectorAll('[data-edge]')).toHaveLength(1);
    expect(screen.getByText('Publish changes')).toBeTruthy();
    expect(screen.queryByText('Deliver changes')).toBeNull();
  });
});

it('opens owned resources inside a service and distinguishes publishers from consumers', () => {
  const owned: AreaView = {
    ...view,
    systems: view.systems.map((system) => ({
      ...system,
      components: system.components.map((item) => {
        if (item.id === 'topic') return { ...item, kind: 'queue', parentComponent: 'editor' };
        if (item.id === 'cache') return { ...item, kind: 'database', parentComponent: 'editor' };
        const use = item.id === 'editor' ? 'Publishes updates' : 'Consumes updates';
        return { ...item, resources: [{ id: 'topic', name: 'Change topic', kind: 'topic', use }] };
      }),
    })),
  };
  const { container } = render(<AreaValueMap view={owned} narrative={narrative} />);
  fireEvent.click(screen.getByRole('button', { name: 'Source' }));
  expect(screen.queryByRole('button', { name: 'Change topic' })).toBeNull();
  expect(
    container.querySelector<SVGGElement>('[data-edge][data-kind="message"]')?.dataset.pattern,
  ).toBe('dotted');
  fireEvent.click(screen.getByRole('button', { name: /Show what Editor holds/u }));
  expect(screen.getByText('Owns data')).toBeTruthy();
  expect(screen.getByText('Publishes to')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /Change topic/u }));
  expect(screen.getByText('Published by')).toBeTruthy();
  expect(screen.getByText('Consumed by')).toBeTruthy();
  expect(screen.queryByText('No published API endpoints were evidenced in this scan.')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /Hide what Editor holds/u }));
  expect(screen.queryByText('Owns data')).toBeNull();
});

it('keeps supporting cards connected and reveals extra exchanges without moving the cards', () => {
  const technical: AreaView['technicalRelationships'] = [
    {
      id: 'support-read',
      from: 'cache',
      to: 'reader',
      fromSystem: 'source',
      toSystem: 'consumer',
      kind: 'api',
      label: 'Read stored inputs',
      detail: 'The reader supplies stored inputs.',
      via: null,
      evidenced: true,
    },
    {
      id: 'support-redundant',
      from: 'cache',
      to: 'topic',
      fromSystem: 'source',
      toSystem: 'source',
      kind: 'data',
      label: 'Keep recent changes',
      detail: 'Keeps a copy of the changes.',
      via: null,
      evidenced: true,
    },
  ];
  const { container } = render(
    <AreaValueMap view={{ ...view, technicalRelationships: technical }} narrative={narrative} />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Source' }));
  const before = [...container.querySelectorAll('foreignObject[data-component]')].map(
    (node) => node.outerHTML,
  );
  expect(container.querySelectorAll('[data-edge]')).toHaveLength(3);
  expect(screen.getByText('Keep recent changes')).toBeTruthy();
  expect(container.querySelectorAll('[data-edge][data-supporting]')).toHaveLength(1);
  expect(
    screen
      .getByText('Keep recent changes')
      .closest('[data-edge-label]')
      ?.hasAttribute('data-quiet'),
  ).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'All connections' }));
  expect(container.querySelectorAll('[data-edge]')).toHaveLength(4);
  expect(screen.getByText('Read stored inputs')).toBeTruthy();
  expect(
    screen
      .getByText('Keep recent changes')
      .closest('[data-edge-label]')
      ?.hasAttribute('data-quiet'),
  ).toBe(false);
  expect(
    [...container.querySelectorAll('foreignObject[data-component]')].map((node) => node.outerHTML),
  ).toEqual(before);
  fireEvent.click(screen.getByRole('button', { name: 'All connections' }));
  expect(container.querySelectorAll('[data-edge]')).toHaveLength(3);
  fireEvent.click(screen.getByRole('button', { name: 'Input cache' }));
  expect(container.querySelectorAll('[data-edge]')).toHaveLength(4);
});

it('shows the authored backbone first, then reveals secondary core calls without moving cards', () => {
  const secondary = {
    from: 'reader',
    to: 'editor',
    kind: 'api' as const,
    label: 'Secondary lookup',
    evidence: ['editor'],
  };
  const overview = [{ ...narrative.connections[1]!, label: 'Use published inputs' }];
  const { container } = render(
    <AreaValueMap
      view={view}
      narrative={{ ...narrative, connections: [...narrative.connections, secondary], overview }}
    />,
  );
  expect(container.querySelectorAll('[data-edge]')).toHaveLength(1);
  expect(screen.getByText('Use published inputs')).toBeTruthy();
  const positions = () =>
    [...container.querySelectorAll<SVGElement>('[data-component]')].map((node) => [
      node.dataset.component,
      node.getAttribute('x'),
      node.getAttribute('y'),
    ]);
  const before = positions();
  fireEvent.click(screen.getByRole('button', { name: 'All connections' }));
  expect(container.querySelectorAll('[data-edge]')).toHaveLength(2);
  expect(screen.getByText('Use published inputs')).toBeTruthy();
  expect(positions()).toEqual(before);
  fireEvent.click(screen.getByRole('button', { name: 'All connections' }));
  fireEvent.click(screen.getByRole('button', { name: 'Source' }));
  expect(container.querySelector('[data-edge][data-context][data-quiet]')).not.toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Editor' }));
  expect(screen.getByText('Secondary lookup')).toBeTruthy();
});

it('reveals the selected flow’s defining exchange after expansion and restores the default on leaving it', () => {
  const calculation = {
    from: 'cache',
    to: 'reader',
    kind: 'api' as const,
    label: 'Read prepared values',
    evidence: ['reader'],
  };
  const story = {
    ...narrative,
    bands: [
      narrative.bands[0]!,
      {
        id: 'calculate',
        title: 'Use prepared values',
        summary: 'Calculate from prepared data.',
        nodes: [
          { component: 'cache', column: 0 },
          { component: 'reader', column: 1 },
        ],
      },
    ],
    connections: [...narrative.connections, calculation],
    overview: [narrative.connections[1]!],
  };
  render(<AreaValueMap view={view} narrative={story} initialFlow="calculate" />);
  fireEvent.click(screen.getByRole('button', { name: 'Source' }));
  const label = screen.getByText('Read prepared values').parentElement;
  expect(label?.hasAttribute('data-context')).toBe(false);
  expect(label?.hasAttribute('data-quiet')).toBe(false);
  fireEvent.change(screen.getByRole('combobox', { name: 'Follow a value flow' }), {
    target: { value: 'publish' },
  });
  expect(screen.queryByText('Read prepared values')).toBeNull();
  expect(screen.getByRole('button', { name: 'Editor' })).toBeTruthy();
});
