import { beforeEach, describe, expect, it } from 'vitest';

import { careInput } from '@/../test/fixtures/plan-index';

import { ageText, partnersVM } from './partners';
import { type WorkspacePlanIndex, workspacePlanIndexOf } from './workspace-plan-index';

let index: WorkspacePlanIndex;

beforeEach(() => {
  index = workspacePlanIndexOf(careInput());
});

const SYSTEMS = [
  { id: 'quotes', name: 'Ziklo quotes', href: '/acme/finance/quotes/', team: 'team:ziklo' },
  { id: 'ledger', name: 'Ziklo ledger', href: '/acme/finance/ledger/', team: 'team:ziklo' },
  { id: 'status', name: 'Status', href: '/acme/finance/status/', team: 'team:orders' },
  { id: 'loose', name: 'Loose', href: '/acme/finance/loose/', team: null },
];

describe('partnersVM', () => {
  it('lists only partners, with their systems, their work across plans and when we last heard', () => {
    expect(partnersVM(index, SYSTEMS, '2026-11-18')).toEqual([
      {
        id: 'team:ziklo',
        name: 'Ziklo',
        href: '/acme/partners/ziklo/',
        systems: [
          { id: 'quotes', name: 'Ziklo quotes', href: '/acme/finance/quotes/' },
          { id: 'ledger', name: 'Ziklo ledger', href: '/acme/finance/ledger/' },
        ],
        work: { total: 1, open: 1, blocked: 0, plans: 1 },
        lastHeard: { at: '2026-11-04', age: '2 weeks ago' },
      },
    ]);
  });

  it('counts held-up and finished work apart, sorts by name, and says when nothing was heard', () => {
    const input = careInput();
    const all = workspacePlanIndexOf({
      ...input,
      teams: [
        { id: 'team:orders', name: 'Orders', partner: true, contacts: [] },
        { id: 'team:ziklo', name: 'Ziklo', partner: true, contacts: [] },
        { id: 'team:acorn', name: 'Acorn', partner: true, contacts: [] },
      ],
    });
    const rows = partnersVM(all, [], '2026-11-04');
    expect(rows.map((r) => r.name)).toEqual(['Acorn', 'Orders', 'Ziklo']);
    expect(rows[0]).toMatchObject({
      work: { total: 0, open: 0, blocked: 0, plans: 0 },
      lastHeard: null,
    });
    expect(rows[1]?.work).toEqual({ total: 4, open: 3, blocked: 1, plans: 3 });
    expect(rows[2]?.lastHeard).toEqual({ at: '2026-11-04', age: 'today' });
  });
});

describe('ageText', () => {
  it('says how long ago a day was, in words', () => {
    expect(ageText('2026-11-04', '2026-11-04')).toBe('today');
    expect(ageText('2026-11-03', '2026-11-04T10:00:00Z')).toBe('yesterday');
    expect(ageText('2026-11-02', '2026-11-04')).toBe('2 days ago');
    expect(ageText('2026-10-22', '2026-11-04')).toBe('13 days ago');
    expect(ageText('2026-10-21', '2026-11-04')).toBe('2 weeks ago');
    expect(ageText('2026-10-28', '2026-11-04')).toBe('7 days ago');
    expect(ageText('2026-09-06', '2026-11-04')).toBe('8 weeks ago');
    expect(ageText('2026-09-05', '2026-11-04')).toBe('2 months ago');
    expect(ageText('2025-11-04', '2026-11-04')).toBe('12 months ago');
    expect(ageText('2026-10-05', '2026-11-04')).toBe('4 weeks ago');
  });

  it('moves to the next unit at its edges, and is careful with the future and nonsense', () => {
    expect(ageText('2026-10-28', '2026-11-05')).toBe('8 days ago');
    expect(ageText('2026-09-05', '2026-11-04')).toBe('2 months ago');
    expect(ageText('2026-08-06', '2026-09-05')).toBe('4 weeks ago');
    expect(ageText('2026-07-06', '2026-09-05')).toBe('2 months ago');
    expect(ageText('2026-08-05', '2026-09-04')).toBe('4 weeks ago');
    expect(ageText('2026-10-03', '2026-11-30')).toBe('8 weeks ago');
    expect(ageText('2026-10-01', '2026-11-30')).toBe('2 months ago');
    expect(ageText('2026-10-01', '2026-10-15')).toBe('2 weeks ago');
    expect(ageText('2026-10-01', '2026-10-08')).toBe('7 days ago');
    expect(ageText('2026-11-05', '2026-11-04')).toBe('ahead of today');
    expect(ageText('soon', '2026-11-04')).toBe('');
  });
});
