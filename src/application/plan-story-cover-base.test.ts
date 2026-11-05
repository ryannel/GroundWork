import { describe, expect, it } from 'vitest';

import { type BaseInfo, NO_BASE } from '@/application/plan/plan-base';

import { baseLine } from './plan-story-cover-base';

const label = (id: string): string => id.replace(/^\w+:/u, '');
const TODAY = new Date(2026, 9, 17);
const live: BaseInfo = { ...NO_BASE, mode: 'live', checkedOn: '2026-10-14' };
const stacked: BaseInfo = {
  ...live,
  builtOn: [
    { slug: 'financing', title: 'Financing status', changed: false },
    { slug: 'sales-tool', title: 'Sales tool', changed: true },
  ],
  programme: { id: 'care-se', changed: true },
  stale: true,
};

describe('baseLine', () => {
  it('says nothing for a plan with no base', () => {
    expect(baseLine(NO_BASE, label, TODAY)).toBeNull();
  });

  it('says when a landed plan landed', () => {
    const landed: BaseInfo = { ...live, mode: 'landed', landedOn: '2026-07-17', checkedOn: null };
    expect(baseLine(landed, label, TODAY)?.text).toBe(
      'Reads today as it stood on 17 Jul, kept with the plan.',
    );
    expect(baseLine({ ...landed, landedOn: null }, label, TODAY)?.text).toBe(
      'Reads today as it stood when it was kept with the plan.',
    );
  });

  it('says when an open plan last fitted today', () => {
    expect(baseLine(live, label, TODAY)).toMatchObject({
      tone: 'note',
      text: 'Reads today live; it last fitted on 14 Oct.',
      link: { chapter: 'today', screen: 'system' },
    });
  });

  it('warns about a plan never checked against today', () => {
    expect(baseLine({ ...live, checkedOn: null }, label, TODAY)?.tone).toBe('warn');
  });

  it('warns when the plan has been edited since its check', () => {
    expect(baseLine({ ...live, edited: true }, label, TODAY)).toMatchObject({
      tone: 'warn',
      text: 'The plan has been edited since it was checked on 14 Oct, so what it says now has not been checked. Run the check again.',
    });
  });

  it('names what today changed under the plan', () => {
    expect(baseLine({ ...live, drift: ['scr:pdp'] }, label, TODAY)?.text).toBe(
      'Today has changed one thing this plan changes since 14 Oct: pdp. Check the plan still holds.',
    );
    expect(baseLine({ ...live, drift: ['svc:a', 'svc:b', 'svc:c'] }, label, TODAY)).toMatchObject({
      tone: 'warn',
      text: 'Today has changed 3 things this plan changes since 14 Oct: a, b and c. Check the plan still holds.',
    });
  });

  it('names the plans a stacked plan reads after', () => {
    const fresh: BaseInfo = {
      ...stacked,
      builtOn: [{ slug: 'financing', title: 'Financing status', changed: false }],
    };
    expect(baseLine({ ...fresh, programme: null, stale: false }, label, TODAY)?.text).toBe(
      'Reads today live after Financing status; it last fitted on 14 Oct.',
    );
    expect(baseLine({ ...stacked, checkedOn: null }, label, TODAY)).toMatchObject({
      tone: 'warn',
      text: 'Reads today live after Financing status and Sales tool, but has never been checked against them.',
    });
  });

  it('names the plans below and the programme that changed since the check', () => {
    expect(baseLine(stacked, label, TODAY)).toMatchObject({
      tone: 'warn',
      text: 'Sales tool and the programme care-se have changed since this plan was checked on 14 Oct; it reads them as they are now. Check the plan again.',
    });
    const one = { ...stacked, programme: { id: 'care-se', changed: false }, drift: ['svc:a'] };
    expect(baseLine(one, label, TODAY)?.text).toBe(
      'Sales tool has changed since this plan was checked on 14 Oct; it reads them as they are now. Check the plan again. Today has changed one thing this plan changes since 14 Oct: a. Check the plan still holds.',
    );
  });
});
