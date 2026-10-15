import { describe, expect, it, vi } from 'vitest';

import type { Rec } from '@/application/plan/ids';
import { validatePlan } from '@/application/plan/validate-plan';
import type { Change, Plan } from '@/domain/plan/plan.generated';

vi.mock('server-only', () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');

const mini = async (): Promise<Plan> => loadFixture('mini.yaml');

function byId<T extends { id: string }>(list: T[] | undefined, id: string): T {
  const found = list?.find((x) => x.id === id);
  if (found === undefined) throw new Error(`no ${id} in the fixture`);
  return found;
}
const chg = (p: Plan, id: string): Change => byId(p.changes, id);
const flow = (p: Plan, id: string) => byId(p.flows, id);
const op = (c: Change, i: number): Rec => c.ops[i] as unknown as Rec;
const opValue = (c: Change, i: number): Rec => op(c, i).value as Rec;

type Mutate = (p: Plan) => void;

const untouched: Mutate = vi.fn();
const dec = (p: Plan) => p.decisions![0]!;
const q = (p: Plan) => p.questions![0]!;

async function run(mutate: Mutate) {
  const p = await mini();
  mutate(p);
  return validatePlan(p);
}

async function expectError(mutate: Mutate, at: string | RegExp, message?: RegExp) {
  const { errors } = await run(mutate);
  const hit = errors.find(
    (e) =>
      (typeof at === 'string' ? e.path === at : at.test(e.path)) &&
      (message?.test(e.message) ?? true),
  );
  expect(hit, `expected error at ${String(at)}; got ${JSON.stringify(errors)}`).toBeDefined();
}

async function expectWarning(mutate: Mutate, at: string, message: RegExp) {
  const { warnings } = await run(mutate);
  expect(
    warnings.some((w) => w.path === at && message.test(w.message)),
    `expected warning at ${at}; got ${JSON.stringify(warnings)}`,
  ).toBe(true);
}

describe('fixture', () => {
  it('validates clean apart from the dual-publish warning', async () => {
    const { errors, warnings } = await run(untouched);
    expect(errors).toEqual([]);
    expect(warnings.map((w) => w.path)).toEqual(['flows[0].steps[1].via']);
  });
});

describe('uniqueness', () => {
  it('duplicate ids', async () =>
    expectError(
      (p) => {
        p.services.push({ ...p.services[0]! });
      },
      'services[4]',
      /duplicate id svc:web/,
    ));
  it('duplicate step ids', async () =>
    expectError(
      (p) => {
        flow(p, 'flow:cancel').steps[1]!.id = 'flow:cancel#request';
      },
      'flows[0].steps[1]',
      /duplicate id/,
    ));
  it('step id must carry its flow prefix', async () =>
    expectError(
      (p) => {
        flow(p, 'flow:cancel').steps[4]!.id = 'flow:billing-run#legacy-email';
        op(chg(p, 'chg:retire-email'), 0).remove = 'flow:billing-run#legacy-email';
      },
      'flows[0].steps[4].id',
      /must start with flow:cancel#/,
    ));
});

describe('dangling refs', () => {
  it('entity ref', async () =>
    expectError(
      (p) => {
        Object.assign(p.services[1]!, { team: 'team:nobody' });
      },
      'services[1].team',
      /team:nobody does not exist; fix the id, or define it/,
    ));
  it('as-is entity may not reference an added id', async () =>
    expectError(
      (p) => {
        flow(p, 'flow:cancel').steps[1]!.via = 'msg:status-changed-v2';
      },
      'flows[0].steps[1].via',
      /added by changes\[1\]\.ops\[1\]/,
    ));
  it('plan-level ref', async () =>
    expectError(
      (p) => {
        p.tests![0]!.proves.push('chg:nope');
      },
      'tests[0].proves[1]',
      /chg:nope does not exist/,
    ));
  it('wrong target type', async () =>
    expectError(
      (p) => {
        Object.assign(p.messages![0]!, { topic: 'svc:subs' });
      },
      'messages[0].topic',
      /expected store/,
    ));
  it('field ref in reads must exist', async () =>
    expectError(
      (p) => {
        flow(p, 'flow:billing-run').steps[0]!.reads = ['sch:invoice#nope'];
      },
      'flows[1].steps[0].reads[0]',
      /does not exist/,
    ));
  it('[[id]] citation in markdown', async () =>
    expectError(
      (p) => {
        Object.assign(p.problem, { why: 'See [[svc:ghost]].' });
      },
      'problem.why',
      /cites \[\[svc:ghost\]\]/,
    ));
  it('[[id]] citation inside an op value', async () =>
    expectError(
      (p) => {
        opValue(chg(p, 'chg:pause-api'), 0).summary = 'x [[dec:nope]]';
      },
      'changes[0].ops[0].value.summary',
      /dec:nope/,
    ));
  it('op target dangling', async () =>
    expectError(
      (p) => {
        op(chg(p, 'chg:retire-email'), 0).remove = 'flow:cancel#ghost';
      },
      'changes[4].ops[0].remove',
      /does not exist/,
    ));
  it('to-be entity refers to something removed', async () =>
    expectError(
      (p) => {
        chg(p, 'chg:retire-email').ops.push({ remove: 'sch:invoice' });
      },
      /flows\[1\]\.steps\[0\]\.reads\[0\]|changes/,
      /removes/,
    ));
  it('a test may walk a removed step (as-is and to-be both count)', async () => {
    const { errors } = await run(untouched);
    expect(errors.some((e) => e.path.startsWith('tests[5]'))).toBe(false);
  });
  it('unknown answered_by or accepted_by is dangling', async () => {
    await expectError((p) => {
      Object.assign(p.questions![0]!, { answered_by: 'dec:nope' });
    }, 'questions[0].answered_by');
    await expectError((p) => {
      Object.assign(p.risks![0]!, { accepted_by: 'dec:nope' });
    }, 'risks[0].accepted_by');
  });
});

describe('op targets are as-is; adds do not collide', () => {
  it('modify an id added earlier in the list is allowed', async () => {
    const { errors } = await run((p) => {
      chg(p, 'chg:analytics-v2').ops.push({
        modify: 'msg:status-changed-v2',
        set: { semantics: 'at-least-once' },
      });
      chg(p, 'chg:retire-email').ops.push({
        modify: 'flow:pause#publish',
        set: { action: 'Publish paused (v2)' },
      });
    });
    expect(errors).toEqual([]);
  });
  it('modify an id added later in the list', async () =>
    expectError(
      (p) => {
        chg(p, 'chg:pause-api').ops.push({
          modify: 'msg:status-changed-v2',
          set: { semantics: 'x' },
        });
      },
      'changes[0].ops[5].modify',
      /added later in the changes list, by changes\[1\]\.ops\[1\]; move this modify after/,
    ));
  it('add collides with an as-is id', async () =>
    expectError(
      (p) => {
        opValue(chg(p, 'chg:pause-api'), 0).id = 'sch:subscription';
      },
      'changes[0].ops[0].value',
      /collides with an as-is id/,
    ));
  it('add collides with an earlier add', async () =>
    expectError(
      (p) => {
        opValue(chg(p, 'chg:status-event-v2'), 0).id = 'sch:pause-request';
      },
      'changes[1].ops[0].value',
      /collides with an earlier add/,
    ));
  it('append to a scalar', async () =>
    expectError(
      (p) => {
        chg(p, 'chg:skip-paused').ops[2] = {
          modify: 'st:billing-db',
          append: { owner: ['svc:subs'] },
        };
      },
      'changes[3].ops[2].append.owner',
      /not a list/,
    ));
  it('after must be a sibling', async () =>
    expectError(
      (p) => {
        op(chg(p, 'chg:skip-paused'), 0).after = 'flow:cancel#publish';
      },
      'changes[3].ops[0].after',
      /not a step of flow:billing-run/,
    ));
  it('remove twice', async () =>
    expectError(
      (p) => {
        chg(p, 'chg:retire-email').ops.push({ remove: 'flow:cancel#legacy-email' });
      },
      'changes[4].ops[1].remove',
      /already removed/,
    ));
});

describe('records need a store', () => {
  it('as-is record without store', async () =>
    expectError(
      (p) => {
        Reflect.deleteProperty(p.schemas![0]!, 'store');
      },
      'schemas[0].store',
      /record, so it needs a store; add `store: st:…` to the schema/,
    ));
  it('added record without store', async () =>
    expectError(
      (p) => {
        opValue(chg(p, 'chg:pause-api'), 0).kind = 'record';
      },
      'changes[0].ops[0].value.kind',
      /needs a store/,
    ));
  it('topic with no message', async () =>
    expectWarning(
      (p) => {
        p.stores!.push({
          id: 'st:silent-events',
          name: 'silent',
          kind: 'topic',
          owner: 'svc:subs',
        });
      },
      'stores[3]',
      /no message says what goes on it/,
    ));
});

describe('step via consistency', () => {
  it('api via: to must be the api service', async () =>
    expectError(
      (p) => {
        const s = flow(p, 'flow:cancel').steps[0]!;
        s.to = 'svc:billing';
        s.writes = [];
      },
      'flows[0].steps[0].to',
      /served by svc:subs/,
    ));
  it('msg via: from producer or to consumer/topic', async () =>
    expectError(
      (p) => {
        flow(p, 'flow:cancel').steps[0]!.via = 'msg:status-changed-v1';
      },
      'flows[0].steps[0].via',
      /producer \(svc:subs\)/,
    ));
  it('to-be step modified onto a message it does not consume', async () =>
    expectError(
      (p) => {
        opValue(chg(p, 'chg:status-event-v2'), 1).consumers = ['svc:analytics'];
      },
      'changes[1].ops[3].set.via',
      /consumers/,
    ));
  it('warns when a to-be step uses a deprecated via', async () =>
    expectWarning(untouched, 'flows[0].steps[1].via', /deprecates/));
  it('errors when a to-be step uses a removed via', async () =>
    expectError(
      (p) => {
        chg(p, 'chg:retire-email').ops.push({ remove: 'msg:status-changed-v1' });
      },
      'flows[0].steps[1].via',
      /changes\[4\]\.ops\[1\] removes/,
    ));
});

describe('reads and writes belong to the acting service', () => {
  it('acting service lacks access', async () =>
    expectError(
      (p) => {
        Object.assign(p.meta, { status: 'review' });
        flow(p, 'flow:cancel').steps[2]!.reads = ['sch:subscription'];
      },
      'flows[0].steps[2].reads[0]',
      /svc:billing \(the acting service\) reads sch:subscription/,
    ));
  it('access grants read, not write', async () =>
    expectError(
      (p) => {
        Object.assign(p.meta, { status: 'approved' });
        Object.assign(p.flows![0]!.steps[3]!, { writes: ['sch:invoice'] });
      },
      'flows[0].steps[3].writes[0]',
      /svc:analytics.*writes sch:invoice/,
    ));
  it('access granted by an op is honoured in the to-be', async () => {
    const { errors } = await run((p) => {
      chg(p, 'chg:skip-paused').ops.push({
        add: 'step',
        into: 'flow:cancel',
        value: {
          id: 'flow:cancel#peek',
          from: 'st:billing-db',
          to: 'svc:subs',
          via: 'internal',
          action: 'Peek',
          reads: ['sch:invoice'],
        },
      });
    });
    expect(errors).toEqual([]);
  });
});

describe('changes are tested and implemented', () => {
  it('change without test', async () =>
    expectError(
      (p) => {
        Object.assign(p.meta, { status: 'review' });
        Object.assign(p, { tests: p.tests!.filter((t) => t.id !== 'tst:no-email') });
      },
      'changes[4]',
      /has no test/,
    ));
  it('change without work item', async () =>
    expectError(
      (p) => {
        Object.assign(p.meta, { status: 'review' });
        Object.assign(p, { work_items: p.work_items!.filter((w) => w.id !== 'wi:retire') });
        for (const w of p.work_items!)
          w.depends_on = (w.depends_on ?? []).filter((d) => d !== 'wi:retire');
      },
      'changes[4]',
      /has no work item/,
    ));
  it('work item implements nothing', async () =>
    expectError(
      (p) => {
        Object.assign(p.work_items![1]!, { implements: [] });
      },
      'work_items[1].implements',
      /at least one change/,
    ));
  it('verified_by test proves none of its changes', async () =>
    expectError(
      (p) => {
        Object.assign(p.work_items![1]!, { verified_by: ['tst:skip-unit'] });
      },
      'work_items[1].verified_by[0]',
      /proves none of wi:v2-event/,
    ));
});

describe('draft plans: completeness rules are warnings', () => {
  it('warn with a draft: prefix while meta.status is draft', async () => {
    const p = await mini();
    expect(p.meta.status).toBe('draft');
    p.tests = p.tests!.filter((t) => t.id !== 'tst:no-email');
    p.work_items = p.work_items!.filter((w) => w.id !== 'wi:retire');
    flow(p, 'flow:cancel').steps[2]!.reads = ['sch:subscription'];
    const { errors, warnings } = validatePlan(p);
    expect(errors).toEqual([]);
    const msgs = warnings.map((w) => `${w.path}: ${w.message}`);
    expect(
      msgs.some((m) =>
        /^changes\[4\]: draft: chg:retire-email has no test .*add a test with proves: \[chg:retire-email\]/.test(
          m,
        ),
      ),
    ).toBe(true);
    expect(
      msgs.some((m) => m.startsWith('changes[4]: draft: chg:retire-email has no work item')),
    ).toBe(true);
    expect(
      msgs.some((m) =>
        m.startsWith('flows[0].steps[2].reads[0]: draft: svc:billing (the acting service) reads'),
      ),
    ).toBe(true);
  });
  it('structural rules stay errors in a draft', async () =>
    expectError(
      (p) => {
        Object.assign(p.work_items![1]!, { implements: [] });
      },
      'work_items[1].implements',
      /at least one change/,
    ));
});

describe('depends_on is acyclic and milestone-ordered', () => {
  it('cycle', async () =>
    expectError(
      (p) => {
        byId(p.work_items, 'wi:v2-event').depends_on = ['wi:retire'];
      },
      /work_items\[\d\]\.depends_on/,
      /dependency cycle: .*wi:v2-event/,
    ));
  it('depends on a later milestone', async () =>
    expectError(
      (p) => {
        byId(p.work_items, 'wi:pause-endpoint').depends_on = ['wi:skip'];
      },
      'work_items[0].depends_on[0]',
      /later milestone \(ms:migrate\)/,
    ));
});

describe('flows have steps', () => {
  it('as-is flow without steps', async () =>
    expectError(
      (p) => {
        flow(p, 'flow:billing-run').steps = [];
        p.changes!.splice(3, 1);
        p.tests!.splice(4, 1);
        p.work_items!.splice(4, 1);
      },
      'flows[1].steps',
      /has no steps/,
    ));
  it('added flow without steps', async () =>
    expectError(
      (p) => {
        opValue(chg(p, 'chg:pause-api'), 4).steps = [];
      },
      'changes[0].ops[4].value.steps',
      /has no steps/,
    ));
  it('to-be flow whose steps are all removed', async () =>
    expectError(
      (p) => {
        chg(p, 'chg:skip-paused').ops = [
          { remove: 'flow:billing-run#select-due' },
          { remove: 'flow:billing-run#charge' },
        ];
      },
      'flows[1]',
      /no steps left in the to-be/,
    ));
  it('step from/to must exist in the as-is graph', async () =>
    expectError(
      (p) => {
        flow(p, 'flow:cancel').steps[1]!.from = 'svc:ghost';
      },
      'flows[0].steps[1].from',
      /svc:ghost does not exist/,
    ));
  it('added step from/to must exist in the to-be graph', async () =>
    expectError(
      (p) => {
        opValue(chg(p, 'chg:skip-paused'), 0).to = 'st:ghost';
      },
      /changes\[3\]\.ops\[0\]\.value\.to/,
      /st:ghost does not exist/,
    ));
});

describe('sources', () => {
  it('permalinks pass; branch refs warn', async () => {
    const p = await mini();
    p.services[0]!.sources = [
      {
        url: 'https://github.com/acme/x/blob/0123456789012345678901234567890123456789/src/a.go#L1-L3',
      },
    ];
    expect(validatePlan(p).warnings.filter((w) => w.message.includes('drift'))).toHaveLength(0);
    p.services[0]!.sources = [{ url: 'https://github.com/acme/x/blob/main/src/a.go' }];
    const { errors, warnings } = validatePlan(p);
    expect(errors).toEqual([]);
    expect(
      warnings.some((w) => w.path === 'services[0].sources[0].url' && w.message.includes('drift')),
    ).toBe(true);
  });
});

describe('decisions, questions and risks', () => {
  it('accepted decision names a decider', async () =>
    expectWarning(
      (p) => {
        delete dec(p).decider;
      },
      'decisions[0]',
      /names no decider/,
    ));
  it('one-way decision records the options it weighed', async () =>
    expectWarning(
      (p) => {
        delete dec(p).options;
      },
      'decisions[0]',
      /one-way but records no options/,
    ));
  it('a proposed decision a change rests on needs an owner and a date', async () =>
    expectWarning(
      (p) => {
        dec(p).status = 'proposed';
        chg(p, 'chg:pause-api').decisions = ['dec:version-event'];
      },
      'decisions[0]',
      /has no decide_by/,
    ));
  it('deferred needs a date to revisit', async () =>
    expectWarning(
      (p) => {
        dec(p).status = 'deferred';
      },
      'decisions[0]',
      /deferred with no decide_by/,
    ));
  it('supersedes marks the old decision superseded', async () => {
    await expectWarning(
      (p) => {
        p.decisions!.push({
          id: 'dec:v3',
          title: 'v3',
          status: 'accepted',
          decider: 'team:subs',
          supersedes: ['dec:version-event'],
        });
      },
      'decisions[1].supersedes[0]',
      /still accepted; mark dec:version-event superseded/,
    );
    await expectError(
      (p) => {
        dec(p).supersedes = ['dec:version-event'];
      },
      'decisions[0].supersedes[0]',
      /cannot supersede itself/,
    );
  });
  it('a question is resolved only once the decision answering it is accepted', async () => {
    await expectWarning(
      (p) => {
        dec(p).status = 'proposed';
        Object.assign(q(p), { status: 'resolved', answered_by: 'dec:version-event' });
      },
      'questions[0].status',
      /still proposed; keep the question open/,
    );
    await expectWarning(
      (p) => {
        q(p).answered_by = 'dec:version-event';
      },
      'questions[0].status',
      /accepted; mark the question resolved/,
    );
    await expectWarning(
      (p) => {
        q(p).status = 'resolved';
      },
      'questions[0]',
      /resolved with no answer/,
    );
  });
  it('an accepted risk names the decision that accepts it', async () => {
    await expectWarning(
      (p) => {
        Object.assign(p.risks![0]!, { roam: 'accepted' });
      },
      'risks[0]',
      /no decision accepts it/,
    );
    await expectWarning(
      (p) => {
        Object.assign(p.risks![0]!, { accepted_by: 'dec:version-event' });
      },
      'risks[0].accepted_by',
      /roam is mitigated/,
    );
  });
  it('open gates block only an approved plan', async () => {
    const p = await mini();
    expect(validatePlan(p).errors).toEqual([]);
    p.meta.status = 'approved';
    expect(
      validatePlan(p).errors.some(
        (e) =>
          e.path === 'questions[0].status' &&
          e.message.includes('answer it before the plan is approved'),
      ),
    ).toBe(true);
    q(p).answered_by = 'dec:version-event';
    expect(validatePlan(p).errors.some((e) => e.path === 'questions[0].status')).toBe(false);
  });
  it('committed is now called approved', async () =>
    expectWarning(
      (p) => {
        Object.assign(p.meta, { status: 'committed' });
      },
      'meta.status',
      /now called "approved"/,
    ));
});
