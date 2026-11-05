import { describe, expect, it } from 'vitest';

import type { Provenance } from '@/application/plan/stack-base';

import { inheritedGroups, inheritedNotesOf, inheritedText } from './plan-inherited';

const SALES: Provenance = { plan: 'sales-tool', title: 'Sales tool', kind: 'added' };
const FINANCE: Provenance = { plan: 'financing', title: 'Financing status', kind: 'modified' };

const FROM: Readonly<Record<string, Provenance>> = {
  'svc:tool': SALES,
  'sch:deal': SALES,
  'sch:deal#status': FINANCE,
  'svc:status': FINANCE,
};

const inheritedFrom = (id: string): Provenance | null => FROM[id] ?? null;

describe('inherited labels', () => {
  it('says which plan below added or changed a thing, and that it is not live yet', () => {
    expect(inheritedText(SALES)).toBe('Added by Sales tool · not live yet');
    expect(inheritedText(FINANCE)).toBe('Changed by Financing status · not live yet');
  });

  it('groups once per plan and kind, in the order first met, each id once', () => {
    expect(
      inheritedGroups(inheritedFrom, ['svc:status', 'svc:tool', 'x', 'sch:deal', 'svc:tool']),
    ).toEqual([
      {
        plan: 'financing',
        title: 'Financing status',
        kind: 'modified',
        text: 'Changed by Financing status · not live yet',
        ids: ['svc:status'],
      },
      {
        plan: 'sales-tool',
        title: 'Sales tool',
        kind: 'added',
        text: 'Added by Sales tool · not live yet',
        ids: ['svc:tool', 'sch:deal'],
      },
    ]);
    expect(inheritedGroups(inheritedFrom, ['x'])).toEqual([]);
  });

  it('looks at the parts of what a screen shows too', () => {
    const model = {
      inheritedFrom,
      asIs: {
        byId: new Map<string, unknown>([
          ['sch:deal#status', {}],
          ['sch:other#x', {}],
        ]),
      },
      toBe: { byId: new Map<string, unknown>([['sch:deal', {}]]) },
    };
    expect(inheritedNotesOf(model, ['sch:deal']).map((g) => [g.text, g.ids])).toEqual([
      ['Added by Sales tool · not live yet', ['sch:deal']],
      ['Changed by Financing status · not live yet', ['sch:deal#status']],
    ]);
  });
});
