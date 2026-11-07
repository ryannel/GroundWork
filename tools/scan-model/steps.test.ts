import { describe, expect, it } from 'vitest';

import type { AuthoredModel } from '@/domain/workspace-model';

import { reconcileSteps } from './steps';

type Step = AuthoredModel<'Step'>;

const step = (id: string, cite: string): Step => ({ id, cites: [cite] });
const span = (value: Step): string | null => value.cites?.[0] ?? null;
const handler = 'h:submit-order';
const branch = (steps: readonly Step[]): Partial<Step> => {
  const value: unknown = JSON.parse(`{"then":${JSON.stringify(steps)}}`);
  return typeof value === 'object' && value !== null ? value : {};
};

describe('scan step identity', () => {
  it('retains IDs and headlines across an insertion and distinguishes equal spans in different branches', () => {
    const prior: Step[] = [
      {
        ...step('guard', 'guard'),
        if: 'the order exists',
        ...branch([{ ...step('load', 'shared'), say: 'Load the order' }]),
        else: [step('missing', 'shared')],
      },
    ];
    const observed: Step[] = [
      step('check', 'start'),
      {
        ...step('renamed-guard', 'guard'),
        if: 'the order exists',
        ...branch([step('changed-slug', 'shared')]),
        else: [step('new-missing-slug', 'shared')],
      },
    ];
    const result = reconcileSteps({ handler, prior, observed, span, aliases: {} });
    expect(result.ambiguities).toEqual([]);
    expect(result.retired).toEqual({});
    expect(result.steps.map(({ id }) => id)).toEqual(['check', 'guard']);
    expect(result.steps[1]?.then).toEqual([{ ...step('load', 'shared'), say: 'Load the order' }]);
    expect(result.steps[1]?.else).toEqual([step('missing', 'shared')]);
    expect(
      reconcileSteps({ handler, prior: result.steps, observed, span, aliases: {} }).steps,
    ).toEqual(result.steps);
  });

  it('keeps a step when evidence names its previously unnamed parallel lane', () => {
    const prior: Step[] = [
      { ...step('parallel', 'join'), parallel: [{ steps: [step('keep', 'source')] }] },
    ];
    const observed: Step[] = [
      {
        ...step('fork', 'join'),
        parallel: [{ lane: 'Pricing', steps: [step('draft', 'source')] }],
      },
    ];
    const result = reconcileSteps({ handler, prior, observed, span, aliases: {} });
    expect(result.ambiguities).toEqual([]);
    expect(result.retired).toEqual({});
    expect(result.steps[0]?.parallel).toEqual([
      { lane: 'Pricing', steps: [step('keep', 'source')] },
    ]);
  });

  it('holds the prior tree when two same-branch observations share an anchor', () => {
    const prior = [step('load', 'same')];
    const observed = [step('first', 'same'), step('second', 'same')];
    expect(reconcileSteps({ handler, prior, observed, span, aliases: {} })).toEqual({
      steps: prior,
      retired: {},
      ambiguities: ['h:submit-order#first', 'h:submit-order#second'],
    });
  });

  it('holds a prior step whose source could not be aligned even when the observation omits it', () => {
    const prior = [{ id: 'unproven' }];
    expect(reconcileSteps({ handler, prior, observed: [], span, aliases: {} })).toEqual({
      steps: prior,
      retired: {},
      ambiguities: ['h:submit-order#unproven'],
    });
  });

  it('tombstones an observed removal and gives a genuinely new step a fresh ID', () => {
    const prior = [
      { ...step('send', 'old'), each: 'recipient', steps: [step('message', 'old-child')] },
    ];
    const observed = [step('send', 'new')];
    const result = reconcileSteps({
      handler,
      prior,
      observed,
      span,
      aliases: { 'h:submit-order#send-retired': { to: null } },
    });
    expect(result.ambiguities).toEqual([]);
    expect(result.steps[0]?.id).toMatch(/^send-[a-f0-9]{12}$/u);
    expect(Object.keys(result.retired)).toEqual([
      'h:submit-order#send',
      'h:submit-order#send/message',
    ]);
    expect(Object.values(result.retired).every((entry) => entry.to === null)).toBe(true);
    expect(
      reconcileSteps({ handler, prior: result.steps, observed, span, aliases: result.retired })
        .steps,
    ).toEqual(result.steps);
  });
});
