import { describe, expect, it, vi } from 'vitest';

import { journeyIndexOf } from './today-journey-index';

vi.mock('server-only', () => ({}));

const { todayData } = await import('@/infrastructure/today-data');
const data = await todayData('alder-finch');
if (data === null) throw new Error('no alder-finch');
const index = journeyIndexOf(data.workspace, data.today.model);
const rows = index.groups.flatMap((g) => g.rows);

describe('journeyIndexOf', () => {
  it('lists every journey and flow once, user journeys first', () => {
    expect(rows).toHaveLength(index.total);
    expect(new Set(rows.map((r) => r.key)).size).toBe(index.total);
    expect(index.groups[0]?.title).toBe('User journeys');
    expect(index.groups[0]?.rows.every((r) => r.kind === 'journey')).toBe(true);
  });

  it('knows the domains each one has steps in, and offers only those', () => {
    const ids = new Set(data.workspace.domains.map((d) => d.id));
    for (const row of rows) for (const d of row.domains) expect(ids.has(d)).toBe(true);
    const used = new Set(rows.flatMap((r) => r.domains));
    expect(index.domains.map((d) => d.id).every((id) => used.has(id))).toBe(true);
  });

  it('can be found by the systems it crosses', () => {
    const row = rows.find((r) => r.through !== '');
    expect(row?.terms).toContain(row?.through.split(', ')[0]?.toLowerCase());
  });
});
