import { describe, expect, it } from 'vitest';

import { explorerFixture, explorerManifestFixture } from '@/../test/service-explorer-kit';

import { explorerServiceOverview } from './explorer-service-overview';

describe('service entry expansion', () => {
  const service = explorerManifestFixture([]).services[0]!;
  const page = explorerFixture();
  const overview = {
    ...page,
    kind: 'overview' as const,
    nodes: [
      { ...page.nodes[0]!, id: 'service', kind: 'component' as const },
      { ...page.nodes[0]!, id: 'entries:http' },
      page.nodes[2]!,
    ],
    links: [
      { ...page.links[0]!, from: 'service', to: 'entries:http' },
      { ...page.links[1]!, from: 'service', to: 'save' },
    ],
  };
  it('shows exact published entries and preserves existing dependency evidence', () => {
    const expanded = explorerServiceOverview(overview, service);
    expect(expanded.nodes.map((node) => node.id)).toEqual(['service', 'save', 'entry']);
    expect(expanded.nodes.at(-1)).toMatchObject({ target: 'flow.json', sourceIds: [] });
    expect(expanded.links).toEqual([
      overview.links[1],
      {
        id: 'published:entry',
        from: 'service',
        to: 'entry',
        label: 'Exposes entry',
        kind: 'interaction',
        sourceIds: [],
      },
    ]);
    expect(overview.nodes).toHaveLength(3);
  });
  it('retains bounded catalogues and does not rewrite implementation or empty views', () => {
    expect(explorerServiceOverview(page, service)).toBe(page);
    expect(explorerServiceOverview(overview, { ...service, entries: [] })).toBe(overview);
    expect(explorerServiceOverview({ ...overview, nodes: [] }, service).nodes).toEqual([]);
    expect(
      explorerServiceOverview(overview, {
        ...service,
        entries: Array.from({ length: 13 }, () => service.entries[0]!),
      }),
    ).toBe(overview);
  });
});
