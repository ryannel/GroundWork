import { describe, expect, it } from 'vitest';

import { explorerFixture } from '@/../test/service-explorer-kit';

import { focusExplorerPage } from './explorer-focus';

describe('focused endpoint source structure', () => {
  it('collapses nested expressions without inventing order or hiding inspectable effects', () => {
    const input = explorerFixture();
    const nested = {
      ...input.nodes[0]!,
      id: 'nested',
      kind: 'call' as const,
      label: 'predicate()',
    };
    const linked = { ...nested, id: 'linked', label: 'sourceHelper()', target: 'helper.json' };
    const page = {
      ...input,
      nodes: [...input.nodes, nested, linked],
      links: [
        ...input.links.filter((link) => link.id !== 'no'),
        {
          ...input.links[0]!,
          id: 'predicate',
          from: 'guard',
          to: nested.id,
          kind: 'branch' as const,
        },
        {
          ...input.links[0]!,
          id: 'failure',
          from: nested.id,
          to: 'failure',
          kind: 'failure' as const,
        },
        { ...input.links[0]!, id: 'helper', from: nested.id, to: linked.id },
      ],
    };
    const result = focusExplorerPage(page, null);
    expect(result.nodes.map((node) => node.id)).not.toContain('nested');
    expect(result.nodes.map((node) => node.id)).toContain('linked');
    expect(result.links).toContainEqual(
      expect.objectContaining({ from: 'guard', to: 'failure', kind: 'failure' }),
    );
    expect(result.links.some((link) => link.from === 'failure' && link.to === 'save')).toBe(false);
    const candidatePage = {
      ...page,
      links: [
        ...page.links,
        {
          ...page.links[0]!,
          id: 'candidate',
          from: 'nested',
          to: 'linked',
          kind: 'interaction' as const,
        },
      ],
    };
    const candidateLinks = focusExplorerPage(candidatePage, null).links;
    // Candidate correspondence is never promoted into a source control branch while collapsing.
    const onlyCandidate = {
      ...candidatePage,
      links: candidatePage.links.filter((link) => link.id !== 'helper'),
    };
    expect(
      focusExplorerPage(onlyCandidate, null).links.find((link) => link.to === 'linked')?.kind,
    ).toBe('interaction');
    expect(candidateLinks.length).toBeGreaterThan(0);
    expect(result.snapshot).toBe(page.snapshot);
    expect(page.nodes).toContainEqual(nested);
    expect(result.gaps.at(-1)).toContain('may contain further behaviour');
    expect(focusExplorerPage(page, 'nested').nodes).toContainEqual(nested);
  });
  it('leaves other views and already focused graphs unchanged and terminates expression cycles', () => {
    const page = explorerFixture();
    expect(focusExplorerPage(page, null)).toBe(page);
    const overview = { ...page, kind: 'overview' as const };
    expect(focusExplorerPage(overview, null)).toBe(overview);
    const nested = { ...page.nodes[0]!, id: 'nested', kind: 'call' as const };
    expect(
      focusExplorerPage(
        {
          ...page,
          nodes: [...page.nodes, nested],
          links: [...page.links, { ...page.links[0]!, from: 'nested', to: 'nested' }],
        },
        null,
      ).nodes,
    ).not.toContainEqual(nested);
  });
});
