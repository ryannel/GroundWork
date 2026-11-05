import { describe, expect, it } from 'vitest';

import { checkProgramme } from '@/application/plan/check-programme';
import type { Neighbours } from '@/domain/plan/plan-neighbours';
import type { Programme } from '@/domain/plan/plan.generated';

const neighbours: Neighbours = {
  slug: 'care-se',
  plans: new Map([
    [
      'financing',
      { ids: new Map([['wi:events', null]]), buildsOn: [], touches: [], hash: '', landed: false },
    ],
  ]),
  programmes: new Map(),
};

const at = { folder: 'care-se', teams: new Set(['team:leads']), neighbours };

const programme = (over: Partial<Programme> = {}): Programme => ({
  id: 'care-se',
  title: 'Care by Volvo in Sweden',
  outcome: 'One Care deal through sale, financing and change; see [[sc:repeat]].',
  scenarios: [{ id: 'sc:repeat', title: 'A status arrives twice' }],
  decisions: [
    { id: 'dec:old', title: 'Old', status: 'superseded' },
    {
      id: 'dec:new',
      title: 'New',
      status: 'accepted',
      decider: 'team:leads',
      supersedes: ['dec:old'],
    },
  ],
  questions: [
    {
      id: 'q:shape',
      question: 'What does the quote hold?',
      status: 'open',
      answered_by: 'dec:new',
    },
  ],
  milestones: [
    { id: 'ms:m1', name: 'Financing status' },
    { id: 'ms:m2', name: 'Order change', after: ['ms:m1'], exit: 'Needs [[financing/wi:events]].' },
  ],
  ...over,
});

describe('checkProgramme', () => {
  it('passes a programme whose ids, teams and citations resolve', () => {
    expect(checkProgramme(programme(), at)).toEqual([]);
  });

  it('wants the id of its folder, and each id once', () => {
    const errors = checkProgramme(
      programme({ id: 'care', scenarios: [{ id: 'ms:m1', title: 'Clash' }] }),
      at,
    );
    expect(errors).toEqual([
      { path: 'id', message: 'the id is care, but the folder is care-se; make them the same' },
      { path: 'milestones[0].id', message: 'ms:m1 is defined twice; rename one' },
      {
        path: 'outcome',
        message: 'cites [[sc:repeat]]: sc:repeat is not in this programme',
      },
    ]);
  });

  it('names what it points at that is not there', () => {
    const errors = checkProgramme(
      programme({
        outcome: 'See [[financing/wi:gone]].',
        decisions: [
          {
            id: 'dec:new',
            title: 'New',
            status: 'accepted',
            decider: 'team:gone',
            supersedes: ['dec:gone'],
          },
        ],
        questions: [{ id: 'q:shape', question: 'Q', status: 'open', answered_by: 'dec:old' }],
        milestones: [{ id: 'ms:m2', name: 'M2', after: ['ms:m9'], serves: 'other/ms:x' }],
      }),
      at,
    );
    expect(errors).toEqual([
      {
        path: 'decisions[0].supersedes[0]',
        message: 'dec:gone is no decision in this programme; fix the id',
      },
      {
        path: 'questions[0].answered_by',
        message: 'dec:old is no decision in this programme; fix the id',
      },
      {
        path: 'milestones[0].after[0]',
        message: 'ms:m9 is no milestone in this programme; fix the id',
      },
      {
        path: 'decisions[0].decider',
        message: 'team:gone is not in workspace.yaml; fix the team id',
      },
      {
        path: 'milestones[0].serves',
        message: 'a programme milestone is what plan milestones serve; it serves none',
      },
      {
        path: 'outcome',
        message:
          'cites [[financing/wi:gone]]: financing/wi:gone does not exist in financing; fix the id, or define it there',
      },
    ]);
  });
});
