// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { systemFixture } from '@/../test/fixtures/model-current-system';
import { indexOf } from '@/application/model-index';
import { modelSystemViewOf } from '@/application/model-system';

import { CatalogueList } from './catalogue-list';
import { ModelSystemOverview, ModelSystemPlans } from './model-system-content';

afterEach(cleanup);
describe('native system content', () => {
  it('retains inferred story text, sources and caveats without manufacturing execution or flows', () => {
    const index = indexOf(systemFixture());
    const before = index.edges();
    const view = modelSystemViewOf(index, { domain: 'queries', system: 'a' });
    if (view === null) throw new Error('Missing system');
    render(<ModelSystemOverview view={view} />);
    expect(screen.queryByText('The original story summary.')).toBeNull();
    const disclosure = screen.getByText('An inferred story').closest('details');
    if (disclosure === null) throw new Error('Missing story disclosure');
    disclosure.open = true;
    fireEvent(disclosure, new Event('toggle'));
    expect(screen.getByText('The original story summary.')).toBeTruthy();
    expect(screen.getByText('Suggested by the cited source.')).toBeTruthy();
    expect(screen.getByText('The original first paragraph.')).toBeTruthy();
    expect(screen.getByText('The original second paragraph.')).toBeTruthy();
    expect(screen.getByText('Execution has not been verified.')).toBeTruthy();
    expect(screen.getByText(/input fingerprint aaaaa/u)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'GET /a' }).getAttribute('href')).toMatch(
      /^\/queries\/entries\/?\?id=api-a$/u,
    );
    expect(
      screen.getAllByRole('link', { name: /fixture\/a\/flow.ts @ aaaa/u, hidden: true }).length,
    ).toBeGreaterThan(0);
    expect(view.flows.map((flow) => flow.id)).toEqual(['flow:story']);
    expect(index.edges()).toEqual(before);
    expect(before.some((edge) => edge.from === 'svc:a' && edge.to === 'svc:b')).toBe(false);
  });

  it('keeps every catalogue head, note and exact count with full records reachable from its inspector', () => {
    const items = Array.from({ length: 8 }, (_, at) => ({
      id: `api:item-${String(at)}`,
      label: `Entry ${String(at)}`,
      glyph: '⇄',
      mono: false,
    }));
    const row = {
      head: { id: 'svc:provider', label: 'The recorded provider', glyph: '▣', mono: false },
      note: 'The complete authored note.',
      items,
    };
    const { container } = render(
      <CatalogueList catalogue={{ apis: [row], events: [], data: [] }} previewItems={false} />,
    );
    expect(screen.getByRole('button', { name: 'The recorded provider' }).dataset.inspect).toBe(
      'svc:provider',
    );
    expect(screen.getByText('The complete authored note.')).toBeTruthy();
    expect(screen.getByText('8 calls')).toBeTruthy();
    expect(container.querySelector('details')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Entry 0' })).toBeNull();
    expect(row.items).toBe(items);
    expect(row.items).toHaveLength(8);
  });

  it('bounds the initial entry list and counts every repeated gap', () => {
    const index = indexOf(systemFixture());
    const view = modelSystemViewOf(index, { domain: 'queries', system: 'a' });
    if (view === null) throw new Error('Missing system');
    const entries = Array.from({ length: 65 }, (_, number) => ({
      id: `api:entry-${String(number)}`,
      name: `Entry ${String(number)}`,
      kind: 'endpoint',
      href: `/queries/entries/?id=api-entry-${String(number)}`,
    }));
    const gaps = Array.from({ length: 1787 }, (_, number) => ({
      id: `api:entry-${String(number)}`,
      kind: 'unmapped_target',
      message: 'The selected path is not mapped.',
      reference: `Selection.field${String(number)}`,
    }));
    render(<ModelSystemOverview view={{ ...view, entries, gaps }} />);
    expect(screen.getAllByRole('link', { name: /^Entry \d+$/u })).toHaveLength(30);
    expect(
      screen.getByRole('link', { name: 'All 65 recorded entries →' }).getAttribute('href'),
    ).toMatch(/^\/queries\/entries\/?\?system=sys-a$/u);
    expect(screen.getAllByText('The selected path is not mapped. (1787 occurrences)')).toHaveLength(
      1,
    );
    expect(gaps).toHaveLength(1787);
  });

  it('shows an exact progress label and leaves absent plan placement uncertain', () => {
    render(
      <ModelSystemPlans
        plans={{
          items: [
            {
              id: 'plan:one',
              slug: 'actual',
              title: 'Actual plan',
              href: '/queries/plans/actual/',
              workIds: ['wi:one'],
              progress: 'No work progress recorded for 1 assigned item.',
            },
          ],
          domainPlans: 1,
          gaps: [],
        }}
      />,
    );
    expect(screen.getByRole('link', { name: 'Actual plan' }).getAttribute('href')).toMatch(
      /^\/queries\/plans\/actual\/?$/u,
    );
    expect(screen.getByText('No work progress recorded for 1 assigned item.')).toBeTruthy();
  });
});
