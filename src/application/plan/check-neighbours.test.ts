import { describe, expect, it, vi } from 'vitest';

import { neighbourOf, qualifiedProblem } from '@/application/plan/check-neighbours';
import { validatePlan } from '@/application/plan/validate-plan';
import type { Neighbour, Neighbours, Touch } from '@/domain/plan/plan-neighbours';
import type { Change, Plan, WorkItem } from '@/domain/plan/plan.generated';

vi.mock(import('server-only'), () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');

const mini = async (): Promise<Plan> => loadFixture('mini.yaml');

const neighbour = (
  ids: Readonly<Record<string, string | null>>,
  buildsOn: string[] = [],
  touches: Touch[] = [],
  landed = false,
): Neighbour => ({
  ids: new Map(Object.entries(ids)),
  buildsOn,
  touches,
  hash: '',
  landed,
});

/** mini beside a financing plan, a sales-tool plan that builds on it, and the care-se programme. */
const NEIGHBOURS: Neighbours = {
  slug: 'mini',
  plans: new Map([
    ['mini', neighbour({})],
    ['financing', neighbour({ 'wi:event-correlation': null, 'ms:early': null })],
    ['sales-tool', neighbour({ 'wi:find-deal': null }, ['financing'])],
  ]),
  programmes: new Map([
    [
      'care-se',
      neighbour({
        'dec:revised-contract': 'accepted',
        'q:quote-shape': 'open',
        'q:settled': 'resolved',
        'ms:m3': null,
      }),
    ],
  ]),
};

type Edit = (p: Plan) => Plan;

async function errorsOf(edit: Edit, neighbours: Neighbours | null = NEIGHBOURS) {
  const plan = edit(await mini());
  const { errors } = validatePlan(plan, neighbours === null ? {} : { neighbours });
  return errors;
}

/** The plan with the first of a list's entries changed. */
const firstOf = <T>(list: readonly T[] | undefined, over: Partial<T>): T[] =>
  (list ?? []).map((item, i) => (i === 0 ? { ...item, ...over } : item));

const withWork =
  (over: Partial<WorkItem>): Edit =>
  (p) => ({
    ...p,
    work_items: firstOf(p.work_items, over),
  });
const withChange =
  (change: Change): Edit =>
  (p) => ({ ...p, changes: [...(p.changes ?? []), change] });

const serving: Edit = (p) => ({
  ...p,
  milestones: firstOf(p.milestones, { serves: 'care-se/ms:m3' }),
});
const joining =
  (programme: string): Edit =>
  (p) => ({ ...p, meta: { ...p.meta, programme } });

describe('what a plan builds on', () => {
  it('accepts plans that exist and never lead back to it', async () => {
    await expect(
      errorsOf((p) => ({ ...p, builds_on: ['sales-tool', 'financing'] })),
    ).resolves.toEqual([]);
  });

  it('names a plan that is not there, and the plan itself', async () => {
    const errors = await errorsOf((p) => ({ ...p, builds_on: ['nowhere', 'mini'] }));
    expect(errors).toEqual([
      { path: 'builds_on[0]', message: 'nowhere is no plan in this workspace; fix the plan id' },
      {
        path: 'builds_on[1]',
        message: 'the plan builds on itself; name the plans it reads on top of today',
      },
    ]);
  });

  it('finds a circle through the plans it builds on', async () => {
    const circle: Neighbours = {
      ...NEIGHBOURS,
      plans: new Map([...NEIGHBOURS.plans, ['financing', neighbour({}, ['mini'])]]),
    };
    const errors = await errorsOf((p) => ({ ...p, builds_on: ['sales-tool'] }), circle);
    expect(errors).toEqual([
      {
        path: 'builds_on',
        message:
          'builds_on runs in a circle (mini → sales-tool → financing → mini); one of these plans must stop building on the next',
      },
    ]);
  });

  it('is not checked when the plan is read without its neighbours', async () => {
    const errors = await errorsOf(
      (p) => withWork({ depends_on: ['nowhere/wi:x'] })({ ...p, builds_on: ['nowhere'] }),
      null,
    );
    expect(errors).toEqual([]);
  });
});

/** NEIGHBOURS with more plans beside mini. */
const beside = (plans: Readonly<Record<string, Neighbour>>): Neighbours => ({
  ...NEIGHBOURS,
  plans: new Map([...NEIGHBOURS.plans, ...Object.entries(plans)]),
});

const changesSvcBilling: Touch[] = [{ change: 'chg:x', kind: 'change', target: 'svc:billing' }];

describe('plans that change the same thing', () => {
  it('is an error for a plan that builds on both when neither builds on the other', async () => {
    const neighbours = beside({
      left: neighbour({}, [], changesSvcBilling),
      right: neighbour(
        {},
        ['financing'],
        [{ change: 'chg:x', kind: 'remove', target: 'svc:billing' }],
      ),
    });
    const errors = await errorsOf((p) => ({ ...p, builds_on: ['left', 'right'] }), neighbours);
    expect(errors).toEqual([
      {
        path: 'builds_on',
        message:
          'builds on left and right, which neither builds on the other, and both touch svc:billing (remove-change: left/chg:x and right/chg:x); what this plan reads would depend on which went first. Make one build on the other, or build on one plan that holds the change',
      },
    ]);
  });

  it('is fine once one builds on the other, or one has landed', async () => {
    const ordered = beside({
      left: neighbour({}, [], changesSvcBilling),
      right: neighbour({}, ['left'], changesSvcBilling),
    });
    await expect(
      errorsOf((p) => ({ ...p, builds_on: ['left', 'right'] }), ordered),
    ).resolves.toEqual([]);
    const landed = beside({
      left: neighbour({}, [], changesSvcBilling, true),
      right: neighbour({}, [], changesSvcBilling),
    });
    await expect(
      errorsOf((p) => ({ ...p, builds_on: ['left', 'right'] }), landed),
    ).resolves.toEqual([]);
  });

  it('warns a plan of each plan beside it that changes what it changes, at its change', async () => {
    const plan = await mini();
    const neighbours = beside({
      other: neighbour({}, [], [{ change: 'chg:other', kind: 'add', target: 'api:subs-pause' }]),
    });
    const { warnings } = validatePlan(plan, { neighbours });
    expect(warnings.filter((w) => w.message.startsWith('overlaps'))).toEqual([
      {
        path: 'changes[0]',
        message:
          'overlaps other (add-add): both add api:subs-pause (mini/chg:pause-api and other/chg:other). Neither builds on the other, so a plan that builds on both cannot be read; order them, or agree which one changes it',
      },
    ]);
    const after = validatePlan({ ...plan, builds_on: ['other'] }, { neighbours });
    expect(after.warnings.filter((w) => w.message.startsWith('overlaps'))).toEqual([]);
  });

  it('does not warn a landed plan', async () => {
    const neighbours: Neighbours = {
      ...NEIGHBOURS,
      plans: new Map([
        ...NEIGHBOURS.plans,
        ['mini', neighbour({}, [], [], true)],
        ['other', neighbour({}, [], [{ change: 'chg:o', kind: 'add', target: 'api:subs-pause' }])],
      ]),
    };
    const { warnings } = validatePlan(await mini(), { neighbours });
    expect(warnings.filter((w) => w.message.startsWith('overlaps'))).toEqual([]);
  });
});

describe('the programme a plan joins', () => {
  it('must be a programme of the workspace', async () => {
    const errors = await errorsOf(joining('care-no'));
    expect(errors).toEqual([
      {
        path: 'meta.programme',
        message:
          'care-no is no programme in this workspace; add programmes/care-no/programme.yaml or fix the id',
      },
    ]);
  });

  it('is the one whose milestones the plan serves', async () => {
    await expect(errorsOf((p) => serving(joining('care-se')(p)))).resolves.toEqual([]);
    await expect(errorsOf(serving)).resolves.toEqual([
      {
        path: 'milestones[0].serves',
        message:
          "care-se/ms:m3 is a milestone of care-se, but the plan joins no programme; serve its own programme's milestones (meta.programme)",
      },
    ]);
  });
});

describe('ids in other plans and the programme', () => {
  it('resolves qualified ids where the plan names them', async () => {
    const errors = await errorsOf((p) =>
      withWork({
        depends_on: ['financing/wi:event-correlation'],
        blocked_by: ['care-se/dec:revised-contract', 'q:trial-pause'],
      })({
        ...p,
        meta: { ...p.meta, programme: 'care-se' },
        milestones: (p.milestones ?? []).map((m, i) =>
          i === 1 ? { ...m, after: ['ms:skeleton', 'financing/ms:early'] } : m,
        ),
        problem: {
          ...p.problem,
          summary: 'Builds on [[financing/wi:event-correlation]] and [[care-se/q:quote-shape]].',
        },
      }),
    );
    expect(errors).toEqual([]);
  });

  it('names a qualified id that is not there, or not the kind the place takes', async () => {
    const errors = await errorsOf((p) =>
      withWork({ depends_on: ['financing/wi:gone', 'elsewhere/wi:x', 'financing/ms:early'] })({
        ...p,
        problem: { ...p.problem, summary: 'See [[care-se/dec:gone]].' },
      }),
    );
    expect(errors).toEqual(
      expect.arrayContaining([
        {
          path: 'work_items[0].depends_on[0]',
          message: 'financing/wi:gone does not exist in financing; fix the id, or define it there',
        },
        {
          path: 'work_items[0].depends_on[1]',
          message:
            'elsewhere/wi:x names elsewhere, which is no plan or programme in this workspace; fix the folder name',
        },
        {
          path: 'work_items[0].depends_on[2]',
          message: 'financing/ms:early is a milestone; expected workItem — point at one of those',
        },
        {
          path: 'problem.summary',
          message:
            'cites [[care-se/dec:gone]]: care-se/dec:gone does not exist in care-se; fix the id, or define it there',
        },
      ]),
    );
  });

  it('says nothing of an id that is not qualified', () => {
    expect(qualifiedProblem(NEIGHBOURS, 'wi:local', ['workItem'])).toBeNull();
  });

  it('reads the ids and statuses a plan or programme as written defines', () => {
    const read = neighbourOf({
      meta: { id: 'care-se' },
      builds_on: ['financing'],
      questions: [{ id: 'q:shape', status: 'open' }],
      changes: [{ id: 'chg:x', requires: [{ id: 'req:y', text: 'Y' }] }],
    });
    expect([...read.ids]).toEqual([
      ['q:shape', 'open'],
      ['chg:x', null],
      ['req:y', null],
    ]);
    expect(read.buildsOn).toEqual(['financing']);
    expect(read.landed).toBe(false);
    expect(read.hash).toMatch(/^[0-9a-f]{8}$/u);
    expect(neighbourOf('not a plan')).toMatchObject({ ids: new Map(), buildsOn: [], touches: [] });
  });
});

const REQUIRES = [{ id: 'req:original-rates', text: 'The quote says whether the rates hold.' }];

const proving =
  (proves: string[]): Edit =>
  (p) => ({
    ...p,
    changes: firstOf(p.changes, { requires: REQUIRES }),
    tests: firstOf(p.tests, { proves }),
    problem: { ...p.problem, summary: 'Needs [[req:original-rates]].' },
  });

const quote = (blocker: string): Change => ({
  id: 'chg:quote',
  title: 'Quote',
  requires: REQUIRES,
  blocked_by: [blocker],
});

describe('a change with no ops yet', () => {
  const noOpenQuestion = {
    path: 'changes[5].blocked_by',
    message:
      'chg:quote has no ops and no open question holds it back; add the ops, or name the open question in blocked_by',
  };

  it('is allowed while it says what it requires and an open question holds it back', async () => {
    await expect(errorsOf(withChange(quote('q:trial-pause')))).resolves.toEqual([]);
    await expect(errorsOf(withChange(quote('care-se/q:quote-shape')))).resolves.toEqual([]);
  });

  it('needs what it requires', async () => {
    const errors = await errorsOf(withChange({ id: 'chg:quote', title: 'Quote', ops: [] }));
    expect(errors).toContainEqual({
      path: 'changes[5]',
      message: 'chg:quote has no ops; say what it requires (requires), or add the ops that make it',
    });
  });

  it('needs an open question, not a decision or a resolved one', async () => {
    await expect(errorsOf(withChange(quote('dec:version-event')))).resolves.toContainEqual(
      noOpenQuestion,
    );
    await expect(errorsOf(withChange(quote('care-se/q:settled')))).resolves.toContainEqual(
      noOpenQuestion,
    );
    await expect(
      errorsOf(withChange(quote('care-se/dec:revised-contract'))),
    ).resolves.toContainEqual(noOpenQuestion);
  });

  it('lets a test prove one of its requirements, and a citation name it', async () => {
    await expect(errorsOf(proving(['chg:pause-api', 'req:original-rates']))).resolves.toEqual([]);
    const missing = await errorsOf(proving(['req:gone']));
    expect(missing.find((e) => e.path === 'tests[0].proves[0]')?.message).toMatch(
      /^req:gone does not exist/u,
    );
  });
});
