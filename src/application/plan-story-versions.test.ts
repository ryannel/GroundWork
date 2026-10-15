import { describe, expect, it, vi } from 'vitest';

import { deliveryOf } from '@/application/plan/delivery';
import { derive } from '@/application/plan/derive';
import { buildRevision } from '@/application/plan/revision';
import { versionKey, versionScreens } from '@/application/plan-pages-screens-versions';
import { wordDiff } from '@/application/plan-story-versions-diff';
import { historyView } from '@/application/plan-story-versions-history';
import { versionView } from '@/application/plan-story-versions-view';
import { dayText, plural, tenseOf } from '@/application/plan-story-versions-words';
import type { Plan } from '@/domain/plan/plan.generated';

vi.mock('server-only', () => ({}));

const { readLoadedPlan } = await import('@/infrastructure/workspace-plans');

const SLUGS = ['delivery-promise', 'invoice-vat-number', 'stock-reservation', 'storefront-graph'];

async function planOf(slug: string): Promise<Plan> {
  const loaded = await readLoadedPlan('alder-finch', slug);
  if (loaded === null) throw new Error(`no ${slug}`);
  return loaded.plan;
}

type Ledger = NonNullable<Plan['meta']['revisions']>;

const LEDGER: Ledger = [
  {
    version: '1.0',
    status: 'approved',
    date: '2026-01-05',
    approved_on: '2026-01-06',
    summary: 'The first one.',
  },
  {
    version: '1.1',
    status: 'rejected',
    date: '2026-02-01',
    rejected_on: '2026-02-03',
    summary: 'A try that went wrong.',
    reason: 'It moved the wrong teams.',
    by: ['@mina-ortiz'],
  },
  { version: '1.2', status: 'rejected', date: '2026-02-10', summary: 'Another, unexplained.' },
  {
    version: '1.3',
    status: 'proposed',
    date: '2026-03-01',
    summary: 'The live one.',
    why: 'Because it is needed.',
    pr: 42,
  },
];

/** A ledger whose later versions are another plan altogether, so the diff touches every part of a plan. */
async function revisionBetween(from: string, to: string) {
  const [a, b] = [await planOf(from), await planOf(to)];
  const head: Plan = { ...b, meta: { ...b.meta, revisions: LEDGER } };
  const plans: Record<string, Plan> = { '1.0': { ...a, meta: { ...a.meta, revisions: LEDGER } } };
  for (const version of ['1.1', '1.2', '1.3']) plans[version] = head;
  const revision = buildRevision(head, plans['1.0'] ?? null, {
    plans,
    snapshots: Object.keys(plans),
  });
  return { revision, delivery: deliveryOf(head, {}, plans['1.0'] ?? null), model: derive(head) };
}

const PAIRS = SLUGS.flatMap((from) =>
  SLUGS.filter((to) => to !== from).map((to) => [from, to] as const),
);

describe('versions page across plans', () => {
  it.each(PAIRS)('reads every version of %s becoming %s', async (from, to) => {
    const { revision, delivery, model } = await revisionBetween(from, to);
    const data = { revision, delivery };
    for (const step of revision.steps) {
      const view = versionView(model, data, step);
      expect(view.head.headline).not.toBe('');
      expect(new Set(view.sections.map((s) => `${s.key}${'title' in s ? s.title : ''}`)).size).toBe(
        view.sections.length,
      );
    }
  });

  it('puts the live version first and tells a rejected one in the past', async () => {
    const { revision, delivery, model } = await revisionBetween(
      'delivery-promise',
      'storefront-graph',
    );
    const [live, ...rest] = revision.steps;
    expect(live?.entry.status).toBe('proposed');
    const live13 = versionView(model, { revision, delivery }, live ?? revision.steps[0]!);
    expect(live13.sections.map((s) => s.key)).toContain('checks');
    const rejected = rest.find(
      (s) => s.entry.status === 'rejected' && s.entry.reason !== undefined,
    );
    const gone = versionView(model, { revision, delivery }, rejected ?? revision.steps[0]!);
    expect(gone.sections[0]).toMatchObject({ key: 'text', title: 'Why it was rejected' });
    expect(gone.sections.map((s) => s.key)).not.toContain('checks');
  });

  it('says nobody recorded why for a rejection without a reason', async () => {
    const { revision, model } = await revisionBetween('delivery-promise', 'storefront-graph');
    const cards = historyView(model, revision).cards;
    expect(cards.map((c) => c.version)).toEqual(['1.3', '1.2', '1.1', '1.0']);
    expect(cards.find((c) => c.version === '1.2')?.rejection).toEqual({ reason: '' });
    expect(cards.find((c) => c.version === '1.1')?.rejection?.reason).toBe(
      'It moved the wrong teams.',
    );
    expect(cards.at(-1)?.first).not.toBeNull();
  });
});

describe('version screens', () => {
  it('lists the history, then every version newest first', async () => {
    const { model } = await revisionBetween('delivery-promise', 'storefront-graph');
    expect(versionScreens(model).map((s) => s.key)).toEqual([
      'history',
      versionKey('1.3'),
      versionKey('1.2'),
      versionKey('1.1'),
      versionKey('1.0'),
    ]);
  });
});

describe('words', () => {
  it('marks what changed between two lines', () => {
    const { was, now } = wordDiff('Stock is taken at allocation', 'Stock is held at payment');
    expect(was.filter((r) => r.mark === 'del').map((r) => r.text.trim())).toContain('taken');
    expect(now.filter((r) => r.mark === 'ins').map((r) => r.text.trim())).toContain('held');
  });

  it('counts, dates and tenses', () => {
    expect(plural(1, 'check')).toBe('1 check');
    expect(plural(2, 'dependency', 'dependencies')).toBe('2 dependencies');
    expect(dayText('2026-07-17')).toBe('17 Jul 2026');
    expect(tenseOf('proposed').t('would', 'did', 'would have')).toBe('would');
    expect(tenseOf('rejected').t('would', 'did', 'would have')).toBe('would have');
    expect(tenseOf('approved').t('would', 'did', 'would have')).toBe('did');
  });
});
