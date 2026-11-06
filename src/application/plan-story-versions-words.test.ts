import { describe, expect, it } from 'vitest';

import { buildRevision } from '@/application/plan/revision';
import type { RevisionEntry } from '@/application/plan/revision-ledger';
import type { Plan } from '@/domain/plan/plan.generated';

import {
  dayText,
  decidedText,
  plural,
  standText,
  statusLook,
  tellWhy,
  tenseOf,
  unmark,
  whenOf,
} from './plan-story-versions-words';

const entry = (extra: Partial<RevisionEntry> = {}): RevisionEntry => ({
  version: '1.0',
  status: 'proposed',
  date: '2026-10-02',
  ...extra,
});
function history(entries: RevisionEntry[]) {
  const value: Plan = {
    meta: { id: 'versions', title: 'Revisions', revisions: entries },
    problem: { summary: 'Record decisions.' },
    teams: [],
    services: [],
  };
  return buildRevision(value);
}
describe('revision wording', () => {
  it.each(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'])(
    'formats the month %s and keeps the year optional',
    (month) => {
      const months = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ];
      const date = `2026-${String(months.indexOf(month) + 1).padStart(2, '0')}-02`;
      expect(dayText(date)).toBe(`2 ${month} 2026`);
      expect(dayText(`${date}T14:00:00Z`, false)).toBe(`2 ${month}`);
    },
  );
  it('retains an unknown date and leaves absent dates blank', () => {
    expect(dayText('soon')).toBe('soon');
    expect(dayText('2026-13-02')).toBe('2026-13-02');
    expect(dayText(null)).toBe('');
  });
  it('attributes approval to the recorded merge and rejection to the recorded closure', () => {
    expect(decidedText(entry())).toBe('');
    expect(decidedText(entry({ status: 'approved' }))).toBe('Approved');
    expect(decidedText(entry({ status: 'rejected' }))).toBe('Rejected');
    expect(
      decidedText(entry({ status: 'approved', approved_by: 'dana', approval_pr: 54, pr: 32 })),
    ).toBe('Approved when @dana merged pull request #54');
    expect(decidedText(entry({ status: 'approved', approved_by: '@dana', pr: 32 }))).toBe(
      'Approved when @dana merged pull request #32',
    );
    expect(decidedText(entry({ status: 'approved', approved_by: 'team:owners' }))).toBe(
      'Approved when team:owners merged the pull request',
    );
    expect(decidedText(entry({ status: 'approved', approved_by: '' }))).toBe('Approved');
    expect(
      decidedText(entry({ status: 'rejected', rejected_by: 'dana', pr: 32, approval_pr: 54 })),
    ).toBe('Rejected when @dana closed pull request #32');
    expect(decidedText(entry({ status: 'rejected', rejected_by: 'dana', approval_pr: 54 }))).toBe(
      'Rejected when @dana closed pull request #54',
    );
    expect(decidedText(entry({ status: 'rejected', rejected_by: 'dana' }))).toBe(
      'Rejected when @dana closed the pull request',
    );
  });
  it('uses decision dates only when recorded for that status', () => {
    expect(whenOf(entry())).toBe('2026-10-02');
    expect(whenOf(entry({ status: 'approved', approved_on: '2026-10-03' }))).toBe('2026-10-03');
    expect(whenOf(entry({ status: 'approved' }))).toBe('2026-10-02');
    expect(whenOf(entry({ status: 'rejected', rejected_on: '2026-10-04' }))).toBe('2026-10-04');
    expect(whenOf(entry({ status: 'rejected' }))).toBe('2026-10-02');
  });
  it('distinguishes the approved version in force from superseded approvals and unapproved proposals', () => {
    const entries = [
      entry({ status: 'approved' }),
      entry({ version: '1.1', status: 'rejected' }),
      entry({ version: '2.0', status: 'approved' }),
      entry({ version: '3.0' }),
    ];
    const rv = history(entries);
    expect(entries.map((item) => statusLook(rv, item))).toEqual([
      { look: 'superseded', word: 'approved' },
      { look: 'rejected', word: 'rejected' },
      { look: 'in-force', word: 'approved' },
      { look: 'proposed', word: 'proposed' },
    ]);
    expect(
      rv.steps
        .toSorted((left, right) => left.version.localeCompare(right.version))
        .map((step) => standText(rv, step)),
    ).toEqual([
      'The first approved version. 2.0 replaced it.',
      'The plan stayed at 1.0.',
      'It replaced 1.0. It is the version teams build from.',
      'Not approved yet. Until it is, teams build from 2.0.',
    ]);
    const newer = history([...entries, entry({ version: '4.0', status: 'approved' })]);
    expect(
      standText(
        newer,
        newer.steps.find((step) => step.version === '2.0')!,
      ),
    ).toBe('It replaced 1.0. 4.0 later replaced it.');
    const lone = history([entry()]);
    expect(standText(lone, lone.steps[0]!)).toBe(
      'Not approved yet. Until it is, teams build from the approved plan.',
    );
    const rejected = history([entry({ status: 'rejected' })]);
    expect(standText(rejected, rejected.steps[0]!)).toBe(
      'The plan stayed at the approved version.',
    );
  });
  it.each([
    ['proposed', true, false, 'now'],
    ['approved', false, false, 'past'],
    ['rejected', false, true, 'would'],
    [undefined, false, false, 'past'],
  ] as const)('uses the %s tense without implying approval', (status, live, gone, text) => {
    const tense = tenseOf(status);
    expect([tense.live, tense.gone, tense.t('now', 'past', 'would')]).toEqual([live, gone, text]);
  });
  it('keeps plain words, counts and every known reason a team is told first', () => {
    expect(plural(0, 'change')).toBe('0 changes');
    expect(plural(1, 'change')).toBe('1 change');
    expect(plural(2, 'person', 'people')).toBe('2 people');
    expect(unmark('**Bold** and *light* with `code` and [[sys:shop]]')).toBe(
      'Bold and light with code and [[sys:shop]]',
    );
    expect(unmark(null)).toBe('');
    expect(tellWhy(['rework', 'changes', 'drop', 'new', 'edge', 'unknown'])).toBe(
      'its done work is reopened, its open work changes, its work is dropped, it gets new work and it would depend on another team',
    );
    expect(tellWhy([])).toBe('');
  });
});
