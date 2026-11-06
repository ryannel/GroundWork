import { cp, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';

import { entryFlowPageOf } from '@/application/entry-flow-page';
import { indexOf } from '@/application/model-index';
import { apply } from '@/domain/plan-apply';
import { modelRecord, type ModelPlan, type WorkspaceModel } from '@/domain/workspace-model';

import { modelValidator } from './model-schema';
import { readModel } from './read-model';
import { validateModel, validatePlanProjection } from './validate-model';

vi.mock(import('server-only'), () => ({}));
let current: WorkspaceModel;
beforeAll(async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'groundwork-projection-'));
  await cp(path.resolve('test/fixtures/model'), path.join(root, 'model'), { recursive: true });
  const loaded = await readModel('model-fixture', root);
  if (loaded === null) throw new Error('Missing fixture');
  current = loaded;
});
async function proposal(ops: readonly unknown[]): Promise<ModelPlan> {
  const value: unknown = {
    meta: { id: 'plan:reservation', title: 'Renew and release reservations' },
    problem: { summary: 'Financing updates must keep the reservation current.' },
    changes: [{ id: 'chg:renew-and-release', title: 'Renew and release', ops }],
  };
  const check = await modelValidator('plan', 'document');
  if (!check(value)) throw new Error(JSON.stringify(check.errors));
  return value;
}
function handlerAdds(): readonly unknown[] {
  const steps: unknown = parse(`
- { id: load, read: 'sch:order', from: 'st:orders' }
- id: eligible
  if: The order holds a reservation
  then:
    - { id: request, call: 'api:charge' }
    - { id: save, write: 'sch:order', to: 'st:orders' }
`);
  return ['renew', 'release'].map((name) => ({
    add: 'handler',
    into: 'sys:ordering',
    value: {
      id: name === 'renew' ? 'h:renew' : 'h:release',
      component: 'svc:ordering',
      on: 'job:nightly',
      steps,
    },
  }));
}
describe('plan implementation evidence', () => {
  it('keeps six uncited proposed effects visible, while the same values fail as current facts', async () => {
    const plan = await proposal(handlerAdds());
    const before = JSON.stringify(current);
    const result = await validatePlanProjection(plan, current);
    expect(result.problems).toEqual([]);
    expect(result.projection?.proposals).toHaveLength(6);
    expect(result.projection?.proposals).toEqual(
      expect.arrayContaining([
        {
          id: 'h:renew#eligible/save',
          plan: 'plan:reservation',
          change: 'chg:renew-and-release',
          op: 0,
        },
      ]),
    );
    expect(
      result.projection?.afterIndex.gaps().filter((gap) => gap.kind === 'proposed_effect'),
    ).toHaveLength(6);
    await expect(
      validateModel(
        apply(
          plan.changes.flatMap((change) => change.ops ?? []),
          current,
        ),
      ),
    ).resolves.toHaveLength(12);
    expect(JSON.stringify(current)).toBe(before);
    const strict = await modelValidator('workspace', 'Handler');
    const overlay = await modelValidator('plan', 'op');
    for (const op of handlerAdds()) {
      expect(overlay(op)).toBe(true);
      expect(strict(modelRecord(op)?.value)).toBe(false);
    }
    const page = entryFlowPageOf(current, [plan], {
      id: 'job:nightly',
      plan: plan.meta.id,
      version: 'after',
    });
    expect(
      page?.flow?.gaps.filter((gap) => gap.includes('implementation is unverified')),
    ).toHaveLength(6);
  });
  it('checks generic handler replacements after applying the plan', async () => {
    const plan = await proposal([
      {
        modify: 'h:relay',
        set: {
          steps: [
            { id: 'load', read: 'sch:order', from: 'st:orders' },
            { id: 'send', call: 'api:charge' },
          ],
        },
      },
    ]);
    const result = await validatePlanProjection(plan, current);
    expect(result.problems).toEqual([]);
    expect(result.projection?.proposals).toHaveLength(2);
    await expect(
      validateModel(
        apply(
          plan.changes.flatMap((change) => change.ops ?? []),
          current,
        ),
      ),
    ).resolves.not.toEqual([]);
  });
  it('keeps retained citations as context for a changed effect and leaves unchanged facts alone', async () => {
    const prior = indexOf(current);
    const plan = await proposal([{ modify: 'h:confirm#lines/reserve', set: { async: true } }]);
    const result = await validatePlanProjection(plan, current);
    const projected = result.projection;
    expect(result.problems).toEqual([]);
    expect(projected?.proposals).toEqual([
      { id: 'h:confirm#lines/reserve', plan: plan.meta.id, change: 'chg:renew-and-release', op: 0 },
    ]);
    expect(projected?.afterIndex.cites('h:confirm#lines/reserve')).toEqual(
      prior.cites('h:confirm#lines/reserve'),
    );
    expect(
      projected?.afterIndex
        .gaps('h:confirm#lines/reserve')
        .some(
          (gap) =>
            gap.kind === 'proposed_effect' &&
            gap.message.includes('Citations provide source context'),
        ),
    ).toBe(true);
    expect(projected?.afterIndex.cites('h:confirm#load')).toEqual(prior.cites('h:confirm#load'));
    expect(projected?.proposals.some((item) => item.id === 'h:confirm#load')).toBe(false);
    if (projected === null) throw new Error('Missing valid projection');
    await expect(validateModel(projected.after)).resolves.toEqual([
      {
        at: 'h:confirm#lines/reserve',
        message:
          'Proposed behaviour requires implementation evidence before it can become current facts.',
      },
    ]);
  });
  it('rejects unrelated uncited current facts before computing a projection', async () => {
    const invalid = await proposal([
      { modify: 'h:relay', set: { steps: [{ id: 'load', read: 'sch:order', from: 'st:orders' }] } },
    ]);
    const invalidBase = apply(
      invalid.changes.flatMap((change) => change.ops ?? []),
      current,
    );
    const result = await validatePlanProjection(await proposal([]), invalidBase);
    expect(result.projection).toBeNull();
    expect(result.problems).toContainEqual(
      expect.objectContaining({
        at: 'sys:ordering/2/steps/0',
        message: "must have required property 'cites'",
      }),
    );
  });
  it.each([
    {
      modify: 'h:relay',
      set: { steps: [{ id: 'invalid', read: 'sch:order', from: 'svc:ordering' }] },
    },
    { modify: 'h:absent', set: { summary: 'No such handler' } },
  ])('preserves malformed step and missing target failures (%j)', async (op) => {
    const result = await validatePlanProjection(await proposal([op]), current);
    expect(result.projection).toBeNull();
    expect(result.problems.length).toBeGreaterThan(0);
  });
  it('keeps citation syntax checks and rejects empty authored citation lists in plans', async () => {
    const check = await modelValidator('plan', 'op');
    expect(
      check({ add: 'step', into: 'h:relay', value: { id: 'bad', call: 'api:charge', cites: [] } }),
    ).toBe(false);
    expect(
      check({
        add: 'step',
        into: 'h:relay',
        value: { id: 'bad', call: 'api:charge', cites: ['https://example.com/fake-proof'] },
      }),
    ).toBe(false);
  });
});
