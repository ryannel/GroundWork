import { describe, expect, it } from 'vitest';

import { explorerFixture } from '@/../test/service-explorer-kit';

import { explorerPage, isExplorerPage } from './service-explorer-check';

describe('delivered service explorer evidence', () => {
  it('preserves branches, async paths, source anchors and unresolved boundaries', () => {
    const page = explorerFixture();
    expect(explorerPage(page)).toBe(page);
    expect(isExplorerPage({ ...page, kind: 'callers' })).toBe(true);
    expect(
      isExplorerPage({
        ...page,
        fields: [
          {
            name: 'id',
            type: 'string',
            nullable: 'unknown',
            required: 'yes',
            sourceIds: ['source:fixture'],
          },
        ],
      }),
    ).toBe(true);
  });
  it('rejects dangling edges, missing source anchors and duplicate identities', () => {
    const page = explorerFixture();
    for (const changed of [
      { ...page, links: [...page.links, { ...page.links[0], id: 'bad', from: 'absent' }] },
      { ...page, nodes: [...page.nodes, page.nodes[0]] },
      { ...page, sources: [] },
      {
        ...page,
        fields: [
          { name: 'id', type: 'string', nullable: 'yes', required: 'no', sourceIds: ['absent'] },
        ],
      },
    ]) {
      expect(isExplorerPage(changed)).toBe(false);
    }
  });
  it('rejects malformed, oversized and unrecognised graph data before display', () => {
    const page = explorerFixture();
    for (const changed of [
      null,
      [],
      {},
      { ...page, format: 'other' },
      { ...page, kind: 'observed-runtime' },
      { ...page, completeSelection: 'yes' },
      { ...page, gaps: [7] },
      { ...page, title: 9 },
      { ...page, nodes: null },
      { ...page, links: null },
      { ...page, fields: null },
      { ...page, sources: null },
      {
        ...page,
        nodes: [
          {
            id: 'fake',
            label: 'fake',
            detail: 'fake',
            kind: 'security-proven',
            sourceIds: [],
            target: null,
          },
        ],
      },
      {
        ...page,
        sources: [{ id: 'source:fixture', label: 'Source', url: 'http://insecure.example/source' }],
      },
      {
        ...page,
        fields: [{ name: 'id', type: 'string', nullable: 'maybe', required: 'yes', sourceIds: [] }],
      },
      {
        ...page,
        nodes: Array.from({ length: 101 }, (_, index) => ({ ...page.nodes[0], id: String(index) })),
      },
    ]) {
      expect(() => explorerPage(changed)).toThrow('Invalid or unbounded explorer page');
    }
  });
});
