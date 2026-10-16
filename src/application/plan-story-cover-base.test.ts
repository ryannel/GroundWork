import { describe, expect, it } from 'vitest';

import { NO_BASE } from '@/application/plan/plan-base';

import { baseLine } from './plan-story-cover-base';

const label = (id: string): string => id.replace(/^\w+:/u, '');
const live = { mode: 'live', landedOn: null, checkedOn: '2026-10-14', drift: [] } as const;

describe('baseLine', () => {
  it('says nothing for a plan with no base', () => {
    expect(baseLine(NO_BASE, label)).toBeNull();
  });

  it('says when a landed plan landed', () => {
    const landed = { ...live, mode: 'landed', landedOn: '2026-07-17', checkedOn: null } as const;
    expect(baseLine(landed, label)?.text).toBe(
      'Reads today as it stood on 17 Jul, kept with the plan.',
    );
    expect(baseLine({ ...landed, landedOn: null }, label)?.text).toBe(
      'Reads today as it stood when it was kept with the plan.',
    );
  });

  it('says when an open plan last fitted today', () => {
    expect(baseLine(live, label)).toMatchObject({
      tone: 'note',
      text: 'Reads today live; it last fitted on 14 Oct.',
      link: { chapter: 'today', screen: 'system' },
    });
  });

  it('warns about a plan never checked against today', () => {
    expect(baseLine({ ...live, checkedOn: null }, label)?.tone).toBe('warn');
  });

  it('names what today changed under the plan', () => {
    expect(baseLine({ ...live, drift: ['scr:pdp'] }, label)?.text).toBe(
      'Today has changed one thing this plan changes since 14 Oct: pdp. Check the plan still holds.',
    );
    expect(baseLine({ ...live, drift: ['svc:a', 'svc:b', 'svc:c'] }, label)).toMatchObject({
      tone: 'warn',
      text: 'Today has changed 3 things this plan changes since 14 Oct: a, b and c. Check the plan still holds.',
    });
  });
});
