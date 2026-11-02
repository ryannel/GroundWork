import { describe, expect, it } from 'vitest';

import type { ExplorerNode } from '@/domain/service-explorer';
import { explorerPage } from '@/domain/service-explorer-check';

import { corpusIndexPages } from './corpus-index-pages';

describe('complete bounded source indexes', () => {
  const node: ExplorerNode = {
    id: 'entry',
    label: 'A source entry',
    detail: 'Declared source',
    kind: 'entry',
    sourceIds: [],
    target: 'implementation.json',
  };
  const input = {
    id: 'files',
    title: 'Source files',
    snapshot: 'selected',
    fileFor: (id: string) => `${id}.json`,
  };
  it('retains every item and gives the next page a navigable target', () => {
    const nodes = Array.from({ length: 125 }, (_, index) => ({ ...node, id: String(index) }));
    const pages = corpusIndexPages({ ...input, nodes });
    expect(pages).toHaveLength(3);
    expect(pages[0]?.page.nodes.at(-1)?.target).toBe(pages[1]?.file);
    expect(pages[1]?.page.nodes.at(-1)?.target).toBe(pages[2]?.file);
    expect(
      pages.flatMap((page) => page.page.nodes).filter((item) => item.id !== 'next-page'),
    ).toEqual(nodes);
    expect(corpusIndexPages({ ...input, nodes: [] })[0]?.page.nodes).toEqual([]);
  });
  it('splits large source references by bytes and preserves exact provenance', () => {
    const source = {
      id: 'source',
      label: 'Pinned source',
      url: `https://github.com/org/repo/blob/revision/${'path/'.repeat(50)}file.ts`,
    };
    const nodes = Array.from({ length: 70 }, (_, index) => ({
      ...node,
      id: String(index),
      sourceIds: ['source'],
      detail: 'a'.repeat(1500),
    }));
    const pages = corpusIndexPages({ ...input, nodes, sources: new Map([['source', source]]) });
    expect(pages.length).toBeGreaterThan(2);
    for (const item of pages) {
      expect(Buffer.byteLength(JSON.stringify(item.page))).toBeLessThan(65_536);
      expect(explorerPage(item.page).sources).toEqual([source]);
    }
    expect(
      corpusIndexPages({ ...input, nodes: [{ ...node, sourceIds: ['missing'] }] })[0]?.page.sources,
    ).toEqual([]);
  });
});
