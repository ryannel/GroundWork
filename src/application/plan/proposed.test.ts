import { describe, expect, it, vi } from 'vitest';

import { proposedMark, proposedMarks, type MarkImpact } from '@/application/plan/proposed';
import { buildRevision } from '@/application/plan/revision';

vi.mock('server-only', () => ({}));

const { readPlan, readRevision } = await import('@/infrastructure/plan-store');

const WORKSPACE = 'alder-finch';

const read = async (slug: string, version?: string) => {
  const { plan } =
    version === undefined
      ? await readPlan(WORKSPACE, slug)
      : await readRevision({ workspace: WORKSPACE, slug, version });
  if (plan === null) throw new Error(`no ${slug} ${version ?? 'head'}`);
  return plan;
};

const IMPACT: MarkImpact = {
  journeys: [
    {
      id: 'flow:a',
      status: 'changed',
      steps: [
        { id: 'step:1', mark: 'added' },
        { id: 'step:2', mark: 'behaviour' },
        { id: 'step:3', mark: 'same' },
      ],
    },
    { id: 'flow:new', status: 'added' },
    { id: 'flow:quiet', status: 'changed' },
    { id: 'flow:gone', status: 'removed' },
  ],
  fields: [
    { schema: 'sch:x', name: 'a', kind: 'added' },
    { schema: 'sch:x', name: 'b', kind: 'edited' },
    { schema: 'sch:y', name: 'c', kind: 'edited', cosmetic: true },
  ],
  screens: [
    { id: 'scr:a', mark: 'data' },
    {
      id: 'scr:b',
      mark: 'added',
      regions: [
        { id: 'reg:1', mark: 'removed' },
        { id: 'reg:2', mark: 'data' },
      ],
    },
    { id: 'scr:c' },
  ],
};

const head = await read('invoice-vat-number');
const approvedPlan = await read('invoice-vat-number', '1.0');
// The marks are memoised per revision, so each test builds its own.
const proposal = () => buildRevision(head, approvedPlan);
const settled = buildRevision(await read('stock-reservation'));

describe('proposedMarks', () => {
  it('words each mark with the proposed version', () => {
    const m = proposedMarks(proposal(), { impactOf: () => IMPACT });
    expect(m?.version).toBe('1.2');
    expect(m?.base).toBe('1.0');
    expect(Object.fromEntries(m?.marks ?? [])).toMatchObject({
      'step:1': 'new in 1.2',
      'step:2': 'works differently in 1.2',
      'flow:a': 'changes in 1.2',
      'flow:new': 'new in 1.2',
      'flow:gone': 'removed in 1.2',
      'sch:x#a': 'new in 1.2',
      'sch:x#b': 'changes in 1.2',
      'sch:x': 'changes in 1.2',
      'scr:b': 'new in 1.2',
      'reg:1': 'removed in 1.2',
    });
    const ids = [...(m?.marks.keys() ?? [])];
    for (const left of ['step:3', 'flow:quiet', 'sch:y', 'sch:y#c', 'scr:a', 'scr:c', 'reg:2']) {
      expect(ids).not.toContain(left);
    }
  });

  it('marks the changes the diff adds, removes or edits', () => {
    const revision = proposal();
    const m = proposedMarks(revision, { impactOf: () => ({}) });
    const ops = revision.diff?.ops ?? [];
    expect(ops.length).toBeGreaterThan(0);
    for (const o of ops) expect(m?.marks.get(o.change)).toMatch(/ in 1\.2$/);
  });

  it('keeps the first reason for an id, and reads one id', () => {
    const impact = { journeys: [{ id: 'flow:a', status: 'added' }] };
    const revision = proposal();
    expect(proposedMark(revision, 'flow:a', { impactOf: () => impact })).toBe('new in 1.2');
    expect(proposedMark(revision, 'flow:none', { impactOf: () => impact })).toBeNull();
  });

  it('asks for the impact once per revision and delivery state', () => {
    const impactOf = vi.fn(() => IMPACT);
    const fresh = buildRevision(head, null);
    expect(proposedMarks(fresh, { impactOf })).toBeNull();
    const again = proposal();
    proposedMarks(again, { impactOf });
    proposedMarks(again, { impactOf });
    expect(impactOf).toHaveBeenCalledTimes(1);
  });

  it('falls back to the diff alone when the impact cannot be worked out', () => {
    const m = proposedMarks(proposal(), {
      impactOf: () => {
        throw new Error('no impact');
      },
    });
    expect(m?.marks.size).toBeGreaterThan(0);
  });

  it('has no marks without a live proposal, or when an earlier version shows', () => {
    expect(proposedMarks(settled, { impactOf: () => IMPACT })).toBeNull();
    const older = buildRevision(head, approvedPlan, { viewing: '1.0' });
    expect(proposedMarks(older, { impactOf: () => IMPACT })).toBeNull();
  });
});
