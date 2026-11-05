import { describe, expect, it } from 'vitest';

import { ORDER_CHANGE, TEAMS } from '@/../test/fixtures/plan-index';
import { derive } from '@/application/plan/derive';
import { NO_STANDING, standingOf } from '@/application/plan/work-standing';

import { partnerTeamsOf, workCardOf } from './plan-work-cards';

const TODAY = new Date('2026-11-04');
const AT = { workspace: 'acme', slug: 'order-change' };

const withStanding = derive(ORDER_CHANGE, {
  status: { 'wi:revise': { state: 'closed', url: 'https://github.com/acme/orders/issues/41' } },
  today: TODAY,
  standing: {
    ...standingOf(
      ORDER_CHANGE,
      {
        events: [
          {
            at: '2026-10-20',
            subject: 'wi:quote',
            kind: 'commitment',
            state: 'accepted',
            promised_for: '2027-03-01',
          },
        ],
      },
      { teams: TEAMS },
    ),
    changes: [],
  },
});

describe('workCardOf', () => {
  it('draws a partner’s item from where it stands, with no issue', () => {
    const card = workCardOf(withStanding, AT, 'wi:quote');
    expect(card?.team).toEqual({ id: 'team:ziklo', name: 'Ziklo', partner: true });
    expect(card?.issue).toBeNull();
    expect(card?.commitment?.promisedFor).toBe('2027-03-01');
    expect(card?.dates.gapText).toBe('14 days after we need');
    expect(card?.milestone).toEqual({ id: 'ms:quote', label: 'Ziklo can quote' });
  });

  it('gives our item its issue and its state from the GitHub sync', () => {
    expect(workCardOf(withStanding, AT, 'wi:revise')?.issue).toEqual({
      number: 41,
      url: 'https://github.com/acme/orders/issues/41',
      state: 'closed',
    });
    expect(workCardOf(withStanding, AT, 'wi:revise')?.blockers.map((b) => b.href)).toEqual([
      '/acme/plans/order-change/things/?id=q-shape',
    ]);
  });

  it('still draws a card when there is no progress record, and none for an unknown item', () => {
    const bare = derive(ORDER_CHANGE, { status: {}, today: TODAY, standing: NO_STANDING });
    const card = workCardOf(bare, AT, 'wi:revise');
    expect(card?.team.partner).toBe(false);
    expect(card?.issue).toEqual({
      number: 41,
      url: 'https://github.com/acme/orders/issues/41',
      state: null,
    });
    expect(card?.dates.neededBy).toBeNull();
    expect(card?.lastHeard).toBeNull();
    expect(workCardOf(bare, AT, 'wi:nothing')).toBeNull();
  });

  it('knows which teams are partners only from where the work stands', () => {
    expect([...partnerTeamsOf(withStanding)]).toEqual(['team:ziklo']);
    expect(
      partnerTeamsOf(derive(ORDER_CHANGE, { status: {}, today: TODAY, standing: NO_STANDING }))
        .size,
    ).toBe(0);
  });
});
