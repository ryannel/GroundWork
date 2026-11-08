import { describe, expect, it, vi } from 'vitest';

import {
  appendEvent,
  checkProgress,
  issueStatusOf,
  latestEvent,
} from '@/application/plan/progress';
import type { ProgressEvent } from '@/domain/model/plan.generated';
import type { Plan } from '@/domain/plan/plan.generated';

vi.mock(import('server-only'), () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');

const plan: Plan = await loadFixture('mini.yaml');

const event = (over: Partial<ProgressEvent>): ProgressEvent => ({
  at: '2026-10-20',
  subject: 'wi:pause-endpoint',
  kind: 'work',
  ...over,
});

describe('checkProgress', () => {
  it('passes events about the plan’s work items and milestones in states their kind has', () => {
    const events = [
      event({ state: 'in_progress' }),
      event({
        kind: 'commitment',
        state: 'accepted',
        promised_for: '2026-11-01',
        confidence: 'low',
      }),
      event({ subject: 'ms:skeleton', kind: 'commitment', state: 'proposed', promised_for: null }),
      event({ subject: 'ms:skeleton', kind: 'note', note: 'Demoed.' }),
    ];
    expect(checkProgress(plan, { events })).toEqual([]);
  });

  it('names a subject the plan does not have', () => {
    expect(checkProgress(plan, { events: [event({ subject: 'wi:gone', state: 'done' })] })).toEqual(
      [
        {
          path: 'events[0].subject',
          message: 'wi:gone is no work item or milestone of this plan; fix the id',
        },
      ],
    );
  });

  it('names a state its kind does not have', () => {
    const events = [
      event({ kind: 'commitment', state: 'done' }),
      event({ kind: 'work', state: 'accepted' }),
      event({ kind: 'note', state: 'blocked' }),
    ];
    expect(checkProgress(plan, { events })).toEqual([
      {
        path: 'events[0].state',
        message:
          'a commitment event cannot be done; its states are proposed, accepted, declined, withdrawn',
      },
      {
        path: 'events[1].state',
        message:
          'a work event cannot be accepted; its states are not_started, in_progress, blocked, done',
      },
      { path: 'events[2].state', message: 'a note event cannot be blocked; its states are none' },
    ]);
  });

  it('asks a work event for its state, and keeps promises to commitments', () => {
    const events = [
      event({}),
      event({ state: 'done', confidence: 'high' }),
      event({ kind: 'note', promised_for: '2026-12-01' }),
    ];
    expect(checkProgress(plan, { events }).map((p) => p.path)).toEqual([
      'events[0].state',
      'events[1].promised_for',
      'events[2].promised_for',
    ]);
  });
});

describe('issueStatusOf', () => {
  it('reads each work item’s issue from its latest GitHub event', () => {
    const github = { kind: 'github' as const, repo: 'org/subs', issue: 7 };
    const status = issueStatusOf({
      events: [
        event({ at: '2026-10-21', state: 'done', source: github }),
        event({ at: '2026-10-20', state: 'in_progress', source: github }),
        event({ at: '2026-10-22', state: 'blocked', source: { kind: 'partner-update' } }),
        event({
          subject: 'wi:retire',
          state: 'not_started',
          source: { kind: 'github', url: 'https://x.test/1' },
        }),
        event({ subject: 'wi:other', state: 'blocked', source: { kind: 'github' } }),
        event({ subject: 'wi:said', kind: 'commitment', state: 'accepted', source: github }),
      ],
    });
    expect(status).toEqual({
      'wi:pause-endpoint': {
        state: 'closed',
        closed_at: '2026-10-21',
        url: 'https://github.com/org/subs/issues/7',
      },
      'wi:retire': { state: 'open', url: 'https://x.test/1' },
      'wi:other': { state: 'open' },
    });
  });
});

describe('appendEvent', () => {
  const github = { kind: 'github' as const, repo: 'org/subs', issue: 7 };
  const synced = event({ at: '2026-10-21', state: 'in_progress', source: github });

  it('appends an event that checks, after what is already there', () => {
    const result = appendEvent(plan, { events: [synced] }, event({ state: 'blocked' }));
    expect(result).toEqual({
      appended: true,
      progress: { events: [synced, event({ state: 'blocked' })] },
    });
  });

  it('refuses one about a subject the plan does not have, or in a state its kind does not have', () => {
    const result = appendEvent(
      plan,
      { events: [] },
      event({ subject: 'wi:gone', kind: 'commitment', state: 'done' }),
    );
    expect(result).toEqual({
      appended: false,
      unchanged: false,
      problems: [
        {
          path: 'events[0].subject',
          message: 'wi:gone is no work item or milestone of this plan; fix the id',
        },
        {
          path: 'events[0].state',
          message:
            'a commitment event cannot be done; its states are proposed, accepted, declined, withdrawn',
        },
      ],
    });
  });

  it('blames only the new event, not problems already in the record', () => {
    const broken = event({ subject: 'wi:gone', state: 'done' });
    const result = appendEvent(plan, { events: [broken] }, event({ state: 'done' }));
    expect(result.appended).toBe(true);
  });

  it('leaves out a GitHub work event that says what the latest GitHub event already says', () => {
    const again = event({ at: '2026-10-28', state: 'in_progress', source: github });
    expect(appendEvent(plan, { events: [synced] }, again)).toEqual({
      appended: false,
      unchanged: true,
      problems: [],
    });
    const closed = event({ at: '2026-10-28', state: 'done', source: github });
    expect(appendEvent(plan, { events: [synced] }, closed).appended).toBe(true);
  });

  it('compares only with GitHub events, so a person’s word does not stop the sync', () => {
    const said = event({ at: '2026-10-25', state: 'done', source: { kind: 'partner-update' } });
    const closed = event({ at: '2026-10-28', state: 'done', source: github });
    expect(appendEvent(plan, { events: [synced, said] }, closed).appended).toBe(true);
    const first = event({ subject: 'ms:skeleton', state: 'done', source: github });
    expect(appendEvent(plan, { events: [synced] }, first).appended).toBe(true);
  });

  it('always appends a commitment, even one that repeats the last', () => {
    const promise = event({ kind: 'commitment', state: 'accepted', source: github });
    expect(appendEvent(plan, { events: [promise] }, promise).appended).toBe(true);
  });
});

describe('latestEvent', () => {
  it('takes the latest time, and of equal times the one recorded last', () => {
    const a = event({ at: '2026-10-21', note: 'a' });
    const b = event({ at: '2026-10-21', note: 'b' });
    const c = event({ at: '2026-10-20', note: 'c' });
    expect(latestEvent([a, b, c], () => true)).toBe(b);
    expect(latestEvent([a, b, c], (e) => e.note === 'c')).toBe(c);
    expect(latestEvent([a], () => false)).toBeNull();
  });
});
