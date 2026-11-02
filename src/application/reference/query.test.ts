import { describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';

import { isReferenceKind, referencePage } from './query';

vi.mock(import('server-only'), () => ({}));
const { loadFixture } = await import('@/infrastructure/plan-fixture');
const plan = await loadFixture('mini.yaml');
const model = derive({
  ...plan,
  services: Array.from({ length: 65 }, (_, index) => ({
    id: `svc:catalogue-${String(index)}`,
    name: `Component ${String(index)}`,
    team: index < 60 ? 'team:web' : 'team:subs',
    kind: 'service' as const,
    summary: index === 64 ? 'Needle in the final page' : 'Ordinary component',
  })),
});

describe('reference pages', () => {
  it('bounds the response and keeps every item reachable', () => {
    const first = referencePage(model, 'components', { params: {}, today: true });
    const second = referencePage(model, 'components', { params: { page: '2' }, today: true });
    const last = referencePage(model, 'components', { params: { page: '999' }, today: true });
    expect(first.rows).toHaveLength(30);
    expect(second.rows).toHaveLength(30);
    expect(last.rows).toHaveLength(5);
    expect(first.pages).toBe(3);
    expect(last.query.page).toBe(3);
    expect(new Set([...first.rows, ...second.rows, ...last.rows].map((row) => row.id)).size).toBe(
      65,
    );
  });

  it('searches the entire catalogue before paging, using every search word', () => {
    const result = referencePage(model, 'components', {
      params: { q: ['needle final', 'ignored'] },
      today: true,
    });
    expect(result.total).toBe(1);
    expect(result.rows[0]?.id).toBe('svc:catalogue-64');
    expect(result.rows[0]?.summary).toBe('Needle in the final page');
    expect(
      referencePage(model, 'components', { params: { q: 'needle absent' }, today: true }).rows,
    ).toEqual([]);
  });

  it('applies the team before pagination and accepts short or full team ids', () => {
    const short = referencePage(model, 'components', { params: { team: 'subs' }, today: true });
    const full = referencePage(model, 'components', { params: { team: 'team:subs' }, today: true });
    expect(short.rows).toEqual(full.rows);
    expect(short.rows.map((row) => row.id)).toContain('svc:catalogue-64');
    expect(short.total).toBeLessThan(65);
  });

  it.each(['-1', '0', 'NaN', 'Infinity', '1.5'])('normalises invalid page %s', (page) => {
    expect(referencePage(model, 'services', { params: { page }, today: true }).query.page).toBe(1);
  });

  it('forces today outside a plan and honours plan modes', () => {
    expect(
      referencePage(model, 'services', { params: { show: 'tobe' }, today: true }).query.show,
    ).toBe('asis');
    expect(
      referencePage(model, 'services', { params: { show: 'tobe' }, today: false }).query.show,
    ).toBe('tobe');
    expect(referencePage(model, 'services', { params: {}, today: false }).query.show).toBe('diff');
  });

  it.each([
    'stores',
    'apis',
    'schemas',
    'events',
    'flows',
    'screens',
    'operations',
    'ledger',
  ] as const)('reads %s through the same bounded query', (kind) => {
    const result = referencePage(derive(plan), kind, { params: {}, today: false });
    expect(result.rows.length).toBeLessThanOrEqual(30);
    expect(result.pages).toBeGreaterThanOrEqual(1);
    expect(result.rows.every((row) => row.label.length > 0)).toBe(true);
  });

  it('recognises only supported catalogue kinds', () => {
    expect(isReferenceKind('ledger')).toBe(true);
    expect(isReferenceKind('apis')).toBe(true);
    expect(isReferenceKind('toString')).toBe(false);
    expect(isReferenceKind('unknown')).toBe(false);
  });
});
