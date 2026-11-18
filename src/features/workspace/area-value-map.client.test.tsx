// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { packAreaMapOverview, packAreaMapView } from '@/application/area-map/transport';
import type { AreaComponentView, AreaView } from '@/application/workspace-area';
import type { LandscapeValueFlow } from '@/domain/landscape';
import { historyState } from '@/ui/address-bar';

import { AreaMap } from './area-map.client';
import { AreaValueMap } from './area-value-map.client';

vi.mock(import('next/navigation'), async (original) => {
  const actual = await original();
  return {
    ...actual,
    useRouter: () =>
      ({ refresh: vi.fn<() => void>() }) as unknown as ReturnType<typeof actual.useRouter>,
  };
});

const component = (id: string, name: string): AreaComponentView => ({
  id,
  name,
  kind: 'service',
  summary: name,
  endpoints: [],
  dependencies: [],
  resources: [],
  repository: null,
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
  scope: '',
  reviewed: '',
  limitation: '',
  collaborations: [],
  relationships: [],
  technicalRelationships: [
    {
      id: 'publish-changes',
      from: 'editor',
      to: 'topic',
      fromSystem: 'source',
      toSystem: 'source',
      kind: 'message',
      label: 'Publish changes',
      detail: 'Editor publishes changes.',
      via: null,
      evidenced: true,
    },
    {
      id: 'deliver-changes',
      from: 'topic',
      to: 'reader',
      fromSystem: 'source',
      toSystem: 'consumer',
      kind: 'message',
      label: 'Deliver changes',
      detail: 'The topic delivers changes to Reader.',
      via: null,
      evidenced: true,
    },
  ],
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
  it('shows explicitly grouped services and a shared store on one card', () => {
    const groupedView: AreaView = {
      ...view,
      systems: view.systems.map((system) => ({
        ...system,
        components: system.components.map((item) =>
          item.id === 'cache' ? { ...item, kind: 'database' } : item,
        ),
      })),
    };
    render(
      <AreaValueMap
        view={groupedView}
        narrative={{
          ...narrative,
          cards: [{ id: 'inputs', title: 'Shared inputs', members: ['editor', 'topic', 'cache'] }],
        }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Expand Source' }));
    expect(screen.queryByRole('button', { name: 'Editor' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Show what Shared inputs holds/u }));
    expect(screen.getByRole('button', { name: /Input cache/u })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Editor' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Editor' }));
    expect(screen.getByRole('heading', { name: 'Editor' })).toBeTruthy();
  });

  it('keeps infrastructure out of the canvas and separates component filtering from details', async () => {
    const full = {
      ...view,
      systems: view.systems.map((system) => ({
        ...system,
        components: system.components.map((item) =>
          item.id === 'cache' ? { ...item, infrastructure: true } : item,
        ),
      })),
      technicalRelationships: [
        ...view.technicalRelationships,
        {
          id: 'read-cache',
          from: 'editor',
          to: 'cache',
          fromSystem: 'source',
          toSystem: 'source',
          kind: 'data' as const,
          label: 'Read cache',
          detail: 'Editor reads its cache.',
          via: null,
          evidenced: true,
        },
      ],
      valueFlow: narrative,
    };
    const { container } = render(<AreaMap payload={packAreaMapOverview(full)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Expand Source' }));
    const editor = await screen.findByRole('button', { name: 'Editor' });
    fireEvent.click(screen.getByRole('button', { name: 'All connections' }));
    expect(screen.queryByRole('button', { name: 'Input cache' })).toBeNull();
    expect(container.querySelector('[data-edge][data-kind="data"]')).toBeNull();
    expect(container.querySelectorAll('[data-edge]')).toHaveLength(2);
    fireEvent.click(editor);
    expect(editor.getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelectorAll('[data-edge]')).toHaveLength(1);
    expect(screen.queryByRole('heading', { name: 'Editor' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Details of Editor' }));
    expect(screen.getByRole('heading', { name: 'Editor' })).toBeTruthy();
  });

  it('filters connections from the system card without loading or expanding its details', () => {
    const full = {
      ...view,
      valueFlow: narrative,
      systems: [
        ...view.systems,
        {
          id: 'other',
          name: 'Other',
          purpose: '',
          href: '/',
          components: [component('job', 'Job')],
          resources: [],
        },
      ],
    };
    const read = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', read);
    const { container } = render(
      <AreaMap payload={packAreaMapOverview(full)} detailsHref="/area/map.json" />,
    );
    const edges = () => container.querySelectorAll('[data-edge]');
    expect(edges()).toHaveLength(1);
    const source = screen.getByRole('button', { name: 'Source' });
    const other = screen.getByRole('button', { name: 'Other' });
    fireEvent.click(source);
    expect(source.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(other);
    expect(edges()).toHaveLength(0);
    fireEvent.click(other);
    expect(edges()).toHaveLength(1);
    fireEvent.click(source);
    expect(source.getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'Expand Source' })).toBeTruthy();
    expect(read).not.toHaveBeenCalled();
  });

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
      fireEvent.click(screen.getByRole('button', { name: 'Expand Source' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Expand Source' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Expand Source' }));
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
    const refreshed = {
      ...full,
      systems: full.systems.map((system) =>
        system.id === 'source' ? { ...system, purpose: 'Updated source purpose' } : system,
      ),
    };
    const read = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(packAreaMapView(full)))
      .mockResolvedValueOnce(Response.json(packAreaMapView(refreshed)));
    vi.stubGlobal('fetch', read);
    const rendered = render(
      <AreaMap payload={packAreaMapOverview(full)} detailsHref="/area/map.json" />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Expand Source' }));
    await expect(screen.findByRole('button', { name: 'Editor' })).resolves.toBeTruthy();
    rendered.rerender(
      <AreaMap payload={packAreaMapOverview(refreshed)} detailsHref="/area/map.json" />,
    );
    expect(screen.getByText('Updated source purpose')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Editor' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Expand Source' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Expand Source' }));
    expect(screen.getByText('Loading system details…')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Editor' })).toBeNull();
    pending.resolve(Response.json(packAreaMapView(full)));
    await expect(screen.findByRole('button', { name: 'Editor' })).resolves.toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Collapse Source' }));
    fireEvent.click(screen.getByRole('button', { name: 'Expand Source' }));
    await expect(screen.findByRole('button', { name: 'Editor' })).resolves.toBeTruthy();
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('keeps the overview available after a failed detail read and retries on the next expansion', async () => {
    const full = { ...view, valueFlow: narrative };
    const read = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(Response.json(packAreaMapView(full)));
    vi.stubGlobal('fetch', read);
    render(<AreaMap payload={packAreaMapOverview(full)} detailsHref="/area/map.json" />);
    fireEvent.click(screen.getByRole('button', { name: 'Expand Source' }));
    await expect(
      screen.findByText('Could not load system details. Expand the system to try again.'),
    ).resolves.toBeTruthy();
    expect(screen.getByRole('button', { name: 'Consumer' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Expand Source' }));
    await expect(screen.findByRole('button', { name: 'Editor' })).resolves.toBeTruthy();
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('starts collapsed, expands one system and retains its supporting components', () => {
    render(<AreaValueMap view={view} narrative={narrative} />);
    expect(screen.queryByRole('button', { name: 'Editor' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Expand Source' }));
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
  it('keeps the inspector trail when selecting a flow and follows browser history', () => {
    const original = globalThis.location.href;
    const originalState = historyState();
    const trail = { inspector: 2, trail: ['editor'] };
    try {
      globalThis.history.replaceState(trail, '', '?flow=read#i-topic');
      render(<AreaValueMap view={view} narrative={narrative} initialFlow="read" />);
      const control = screen.getByRole<HTMLSelectElement>('combobox', {
        name: 'Follow a value flow',
      });
      fireEvent.change(control, { target: { value: 'publish' } });
      expect(historyState()).toEqual(trail);
      expect(globalThis.location.search).toBe('?flow=publish');
      expect(globalThis.location.hash).toBe('#i-topic');

      globalThis.history.replaceState(null, '', '?flow=read');
      fireEvent.popState(globalThis.window);
      expect(control.value).toBe('read');
    } finally {
      globalThis.history.replaceState(originalState, '', original);
    }
  });
  it('filters without leaving a line to a hidden system', () => {
    const { container } = render(<AreaValueMap view={view} narrative={narrative} />);
    fireEvent.click(screen.getByRole('button', { name: 'Expand Source' }));
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
  fireEvent.click(screen.getByRole('button', { name: 'Expand Source' }));
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
    <AreaValueMap
      view={{ ...view, technicalRelationships: [...view.technicalRelationships, ...technical] }}
      narrative={narrative}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Expand Source' }));
  const before = [...container.querySelectorAll('foreignObject[data-component]')].map(
    (node) => node.outerHTML,
  );
  expect(container.querySelectorAll('[data-edge]')).toHaveLength(3);
  expect(screen.getByText('Keep recent changes')).toBeTruthy();
  expect(container.querySelectorAll('[data-edge][data-supporting]')).toHaveLength(3);
  expect(
    screen
      .getByText('Keep recent changes')
      .closest('[data-edge-label]')
      ?.hasAttribute('data-quiet'),
  ).toBe(true);
  expect(screen.getByText('Read stored inputs')).toBeTruthy();
  expect(screen.queryByText('Deliver changes')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'All connections' }));
  expect(container.querySelectorAll('[data-edge]')).toHaveLength(4);
  expect(screen.getByText('Deliver changes')).toBeTruthy();
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
  fireEvent.click(screen.getByRole('button', { name: 'Details of Change topic' }));
  expect(container.querySelectorAll('[data-edge]')).toHaveLength(4);
});

it('counts records on one line between closed systems and names them once a system opens', () => {
  const delivery = view.technicalRelationships[1]!;
  const records: AreaView['technicalRelationships'] = [
    ...view.technicalRelationships,
    { ...delivery, id: 'deliver-corrections', label: 'Deliver corrections' },
    {
      ...delivery,
      id: 'acknowledge',
      from: 'reader',
      to: 'topic',
      fromSystem: 'consumer',
      toSystem: 'source',
      label: 'Acknowledge changes',
    },
    {
      ...delivery,
      id: 'secondary-lookup',
      from: 'reader',
      to: 'editor',
      fromSystem: 'consumer',
      toSystem: 'source',
      kind: 'api',
      label: 'Secondary lookup',
      detail: 'Reader looks up the editor.',
    },
  ];
  const { container } = render(
    <AreaValueMap view={{ ...view, technicalRelationships: records }} narrative={narrative} />,
  );
  const positions = () =>
    [...container.querySelectorAll<SVGElement>('[data-component]')].map((node) => [
      node.dataset.component,
      node.getAttribute('x'),
      node.getAttribute('y'),
    ]);
  const before = positions();
  fireEvent.click(screen.getByRole('button', { name: 'All connections' }));
  expect(container.querySelectorAll('[data-edge]')).toHaveLength(2);
  expect(screen.getByText('2 out · 1 in')).toBeTruthy();
  expect(screen.getByText('1 out · 0 in')).toBeTruthy();
  expect(screen.queryByText('Deliver changes')).toBeNull();
  expect(positions()).toEqual(before);
  fireEvent.click(screen.getByRole('button', { name: 'Expand Source' }));
  expect(
    container
      .querySelector('[data-edge="value:topic|read:consumer|message||"]')
      ?.getAttribute('aria-label'),
  ).toMatch(/^Deliver changes; Deliver corrections\n/u);
  expect(screen.queryByText('2 out · 1 in')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'All connections' }));
  expect(container.querySelector('[data-edge][data-context][data-quiet]')).not.toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Details of Editor' }));
  expect(screen.getByText('Secondary lookup')).toBeTruthy();
});

it('highlights the selected flow’s defining exchange after expansion and dims it on leaving the flow', () => {
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
  };
  const record = {
    ...view.technicalRelationships[1]!,
    id: 'read-prepared',
    from: 'cache',
    kind: 'api' as const,
    label: 'Read prepared values',
    detail: 'Input cache reads prepared values from Reader.',
  };
  render(
    <AreaValueMap
      view={{ ...view, technicalRelationships: [...view.technicalRelationships, record] }}
      narrative={story}
      initialFlow="calculate"
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Expand Source' }));
  const label = screen.getByText('Read prepared values').closest('[data-edge-label]');
  expect(label?.hasAttribute('data-context')).toBe(false);
  expect(label?.hasAttribute('data-lit')).toBe(true);
  fireEvent.change(screen.getByRole('combobox', { name: 'Follow a value flow' }), {
    target: { value: 'publish' },
  });
  expect(
    screen
      .getByText('Read prepared values')
      .closest('[data-edge-label]')
      ?.hasAttribute('data-context'),
  ).toBe(true);
  expect(screen.getByRole('button', { name: 'Editor' })).toBeTruthy();
});
