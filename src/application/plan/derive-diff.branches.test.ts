import { describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';
import type { Plan } from '@/domain/plan/plan.generated';

vi.mock(import('server-only'), () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');

const LONG_A =
  'Subscriptions keeps every member’s plan, its status and when it renews, in one place.';
const LONG_B =
  'A wholly different and rather long account of what the subscriptions service is for.';

/** mini.yaml with one change whose ops say things the fixture never does. */
async function withOddOps(): Promise<Plan> {
  const p = await loadFixture('mini.yaml');
  p.services = p.services.map((s) => (s.id === 'svc:billing' ? { ...s, does: LONG_A } : s));
  p.changes = [
    ...(p.changes ?? []),
    {
      id: 'chg:odd',
      title: 'Odd ops',
      ops: [
        { modify: 'svc:subs', set: { does: LONG_A } },
        { modify: 'svc:billing', set: { does: LONG_B } },
        { modify: 'svc:web', set: { image: 'web.png', figma: 'https://figma.com/x' } },
        { modify: 'svc:analytics', set: { team: null, system: 'team:web' } },
        { modify: 'flow:cancel#request', set: { at: 'top' } },
        {
          add: 'step',
          into: 'flow:billing-run',
          value: {
            id: 'flow:billing-run#tally',
            from: 'svc:billing',
            to: 'st:billing-db',
            via: 'internal',
            action: 'Tally',
          },
        },
        { deprecate: 'api:subs-cancel' },
        { remove: 'svc:analytics' },
      ],
    },
  ];
  return p;
}

describe('a change said in words, for ops the fixture never makes', () => {
  it('summarises long texts, screenshots, cleared and new ids, moves, bare steps and removals', async () => {
    const m = derive(await withOddOps());
    expect(m.diff('chg:odd').map((e) => e.summary)).toEqual([
      'what it does added',
      'what it does changes',
      'screenshot added',
      'design linked (Figma)',
      'team Platform → (none)',
      'system (none) → Web',
      'request moves on the screen',
      '+ step "Tally" after "Charge"',
      '− deprecated endpoint "POST /subscriptions/{id}/cancel"',
      '× service "Analytics"',
    ]);
  });

  it('joins the props of one op, and says nothing of an op that is not there', async () => {
    const m = derive(await withOddOps());
    expect(m.opSummary('chg:odd', 2)).toBe('screenshot added; design linked (Figma)');
    expect(m.opSummary('chg:odd', 99)).toBe('');
  });

  it('gathers the ops on a container and on what sits inside it', async () => {
    const m = derive(await withOddOps());
    const entries = m.diff('flow:cancel');
    expect(entries.map((e) => e.target)).toContain('flow:cancel#request');
    expect(
      entries.find((e) => e.target === 'flow:cancel#request' && e.prop === 'at'),
    ).toMatchObject({ change: 'set', after: 'top', kind: 'modify' });
    expect(m.diff('api:subs-cancel').map((e) => e.change)).toEqual(['deprecate']);
  });
});
