import { describe, expect, it, vi } from 'vitest';

import { scanFixture } from '@/../test/scan-kit';

import { bindingReviewDocument, bindingReviewPages } from './scan-bindings-pages';
import { bindingReviewSelection } from './scan-bindings-selection';

vi.mock(import('server-only'), () => ({}));

describe('bounded native binding evidence', () => {
  it('reconstructs only returned records and follows explicit source/host references', () => {
    const base = scanFixture();
    const original = {
      ...base,
      gaps: [
        {
          kind: 'gap' as const,
          id: 'gap:selected',
          source: 'source:handler',
          reason: 'unsupported' as const,
          description: 'Unresolved native relation',
        },
      ],
      sources: [
        ...base.sources,
        { ...base.sources[0]!, id: 'source:unselected', path: 'unrelated.java' },
      ],
    };
    const selected = bindingReviewSelection(original);
    expect(selected).toContain('source:handler');
    expect(selected).not.toContain('source:unselected');
    const pages = bindingReviewPages(original, selected);
    expect(
      pages.every(
        (page) => page.records.length <= 4 && Buffer.byteLength(JSON.stringify(page)) <= 65_536,
      ),
    ).toBe(true);
    const bounded = bindingReviewDocument(original.id, pages);
    expect(bounded.sources.map((source) => source.id)).toEqual(['source:handler']);
    expect(bounded.hosts.map((host) => host.id)).toEqual(['host:server']);
    expect(bounded.gaps).toHaveLength(1);
    expect(bounded.summaries).toEqual([]);
  });
  it('rejects oversized individual records and total record overflow', () => {
    const base = scanFixture();
    const source = base.sources[0]!;
    expect(() =>
      bindingReviewPages({ ...base, sources: [{ ...source, path: 'x'.repeat(70_000) }] }, [
        source.id,
      ]),
    ).toThrow('oversized');
    expect(() =>
      bindingReviewPages(
        base,
        Array.from({ length: 8193 }, (_, index) => String(index)),
      ),
    ).toThrow('8192');
  });
});
