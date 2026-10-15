import { describe, expect, it, vi } from 'vitest';

import {
  approvedRevision,
  compareVersions,
  currentRevision,
  proposedRevision,
  type RevisionEntry,
} from '@/application/plan/revision-ledger';
import { validatePlan } from '@/application/plan/validate-plan';
import type { Plan } from '@/domain/plan/plan.generated';

vi.mock('server-only', () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');

const A: RevisionEntry = {
  version: '1.0',
  status: 'approved',
  date: '2026-09-01',
  approved_on: '2026-09-10',
  approved_by: '@priya-shah',
};
const P: RevisionEntry = { version: '1.1', status: 'proposed', date: '2026-10-01' };

type Mutate = (p: Plan) => void;

const meta =
  (fields: { [K in keyof Plan['meta']]?: Plan['meta'][K] | undefined }): Mutate =>
  (p) => {
    Object.assign(p.meta, fields);
  };

/** Sets the ledger, and meta.version to the last entry that was not rejected. */
const ledger = (list: RevisionEntry[]): Mutate =>
  meta({ revisions: list, version: list.findLast((r) => r.status !== 'rejected')?.version });

async function run(mutate: Mutate) {
  const p = await loadFixture('mini.yaml');
  mutate(p);
  return validatePlan(p);
}

async function expectError(mutate: Mutate, at: string, message: RegExp) {
  const { errors } = await run(mutate);
  expect(
    errors.some((e) => e.path === at && message.test(e.message)),
    `expected error at ${at}; got ${JSON.stringify(errors)}`,
  ).toBe(true);
}

async function expectWarning(mutate: Mutate, at: string, message: RegExp) {
  const { warnings } = await run(mutate);
  expect(
    warnings.some((w) => w.path === at && message.test(w.message)),
    `expected warning at ${at}; got ${JSON.stringify(warnings)}`,
  ).toBe(true);
}

const metaErrors = async (mutate: Mutate) => {
  const { errors } = await run(mutate);
  return errors.filter((e) => e.path.startsWith('meta'));
};

describe('revision ledger checks', () => {
  it('a clean ledger validates', async () => {
    const list = [A, { ...P, summary: 'split the topic', by: ['team:web'] }];
    expect(await metaErrors(ledger(list))).toEqual([]);
  });

  it('versions ascend numerically (1.10 follows 1.9)', async () => {
    await expectError(
      ledger([A, { ...P, version: '1.0' }]),
      'meta.revisions[1].version',
      /does not follow 1\.0/,
    );
    await expectError(
      ledger([
        { ...A, version: '1.10' },
        { ...P, version: '1.9' },
      ]),
      'meta.revisions[1].version',
      /does not follow 1\.10/,
    );
    const ascending = ledger([
      { ...A, version: '1.9' },
      { ...P, version: '1.10' },
    ]);
    expect(await metaErrors(ascending)).toEqual([]);
  });

  it('only the last entry may be proposed', async () => {
    await expectError(
      ledger([{ ...P, version: '1.0' }, P]),
      'meta.revisions[0].status',
      /only the last entry can be proposed/,
    );
  });

  it('meta.version names the last entry that was not rejected', async () => {
    await expectError(
      meta({ revisions: [A, P], version: '1.0' }),
      'meta.version',
      /meta\.revisions says this file is version 1\.1/,
    );
    await expectError(
      meta({ revisions: [A, { ...P, status: 'rejected' }], version: '1.1' }),
      'meta.version',
      /meta\.revisions says this file is version 1\.0/,
    );
    await expectError(
      meta({ revisions: [A], version: undefined }),
      'meta.version',
      /no meta\.version/,
    );
  });

  it('team ids in by must be teams of the plan', async () => {
    await expectError(
      ledger([A, { ...P, by: ['team:nope'] }]),
      'meta.revisions[1].by[0]',
      /not a team in this plan/,
    );
    expect(await metaErrors(ledger([A, { ...P, by: ['Ops guild'] }]))).toEqual([]);
  });

  it("the head's work words must name work items", async () => {
    await expectError(
      ledger([A, { ...P, work: [{ item: 'wi:nope', action: 'rework' }] }]),
      'meta.revisions[1].work[0].item',
      /not a work item in this plan/,
    );
    const dropped = ledger([A, { ...P, work: [{ item: 'wi:gone', action: 'drop' }] }]);
    expect(await metaErrors(dropped)).toEqual([]);
  });

  it('approval fields match the status', async () => {
    await expectWarning(
      ledger([{ version: '1.0', status: 'approved', date: '2026-09-01' }]),
      'meta.revisions[0]',
      /no approved_on/,
    );
    await expectWarning(
      ledger([{ ...P, version: '1.0', approved_on: '2026-09-02' }]),
      'meta.revisions[0]',
      /carries approval fields/,
    );
    await expectWarning(
      meta({ revisions: [{ version: '1.0', status: 'rejected', date: '2026-09-01' }] }),
      'meta.revisions',
      /every version is rejected/,
    );
  });

  it('a rejection says when and why; a proposal says why', async () => {
    const rejected: RevisionEntry = { ...P, status: 'rejected' };
    const list = ledger([A, rejected, { ...P, version: '1.2', why: 'x' }]);
    await expectWarning(list, 'meta.revisions[1]', /says nobody why/);
    await expectWarning(list, 'meta.revisions[1]', /no rejected_on/);
    await expectWarning(
      ledger([A, { ...P, rejected_by: '@x' }]),
      'meta.revisions[1]',
      /carries rejection fields/,
    );
    await expectWarning(ledger([A, P]), 'meta.revisions[1]', /proposed without a why/);
  });
});

describe('revision helpers', () => {
  it('current, approved and proposed', async () => {
    const p = await loadFixture('mini.yaml');
    ledger([A, P])(p);
    expect(currentRevision(p)?.version).toBe('1.1');
    expect(approvedRevision(p)?.version).toBe('1.0');
    expect(proposedRevision(p)).toBe(P);
    ledger([A, { ...P, status: 'rejected' }])(p);
    expect(currentRevision(p)?.version).toBe('1.0');
    expect(proposedRevision(p)).toBeNull();
    const bare = await loadFixture('mini.yaml');
    expect(approvedRevision(bare)).toBeNull();
    expect(currentRevision(null)).toBeNull();
  });

  it('compares versions numerically', () => {
    expect(compareVersions('1.10', '1.9')).toBe(1);
    expect(compareVersions('1.9', '1.10')).toBe(-1);
    expect(compareVersions('2', '2.0')).toBe(0);
    expect(compareVersions(undefined, 'x')).toBe(0);
  });
});

const keyed =
  (key: string): Mutate =>
  (p) => {
    Object.assign(p.messages?.[0] ?? {}, { key });
  };

describe('message keys', () => {
  it('a message key names a payload field', async () => {
    await expectError(
      keyed('no_such_field'),
      'messages[0].key',
      /is keyed by no_such_field.*use one of subscription_id, status/,
    );
    const ok = await run(keyed('status, subscription_id'));
    expect(ok.errors).toEqual([]);
  });
});
