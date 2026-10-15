import { describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';
import { journeyComparison } from '@/application/plan/journey';
import { comparisonOf } from '@/application/plan-viz-journey-compare';
import { absenceOf, outlineOf, rolloutNotes } from '@/application/plan-viz-journey-outline';
import { focusedEvidence, sideContent } from '@/application/plan-viz-journey-sides';
import { journeyMarkerText, modeOf, rowTitle } from '@/application/plan-viz-journey-words';
import type { Plan } from '@/domain/plan/plan.generated';

vi.mock('server-only', () => ({}));

const { readPlan } = await import('@/infrastructure/plan-store');

const planOf = async (slug: string): Promise<Plan> => {
  const { plan } = await readPlan('alder-finch', slug);
  if (plan === null) throw new Error(`no plan ${slug}`);
  return plan;
};
const invoice = derive(await planOf('invoice-vat-number'));
const stock = derive(await planOf('stock-reservation'));
const storefront = derive(await planOf('storefront-graph'));

const flow = 'flow:issue-invoice';
const render = `${flow}#render`;

const rowOf = (model: typeof invoice, flowId: string, id: string) => {
  const comparison = journeyComparison(model, flowId);
  const row = comparison.rows.find((r) => r.id === id);
  if (row === undefined) throw new Error(`no row ${id}`);
  return { comparison, row };
};

describe('the words of a journey', () => {
  it('reads any name for the plan as the plan', () => {
    expect(['toBe', 'planned', 'plan', 'asIs', 'today'].map(modeOf)).toEqual([
      'toBe',
      'toBe',
      'toBe',
      'asIs',
      'asIs',
    ]);
  });

  it('marks a layout-only change as the screen, not as different behaviour', () => {
    const flowId = 'flow:browse-product';
    const { row } = rowOf(storefront, flowId, `${flowId}#reviews`);
    expect(journeyMarkerText(row, 'asIs')).toBe('Screen layout changes');
  });

  it('says a deprecated step is deprecated with the plan, today, and still works, in the plan', () => {
    const { row } = rowOf(invoice, flow, `${flow}#reissue`);
    expect(journeyMarkerText(row, 'asIs')).toBe('Deprecated with this plan · still works');
    expect(journeyMarkerText(row, 'toBe')).toBe('Deprecated · still works');
  });

  it('says nothing for a step that runs as today', () => {
    const { comparison } = rowOf(invoice, flow, render);
    const same = comparison.rows.find((r) => r.kind === 'same' && r.evidence.length === 0);
    expect(journeyMarkerText(same, 'toBe')).toBe('');
    expect(journeyMarkerText(null, 'toBe')).toBe('');
  });

  it('names a step by its action in the chosen view, else the other', () => {
    const { comparison } = rowOf(stock, 'flow:reserve', 'flow:reserve#hold');
    const added = comparison.rows.find((r) => r.id === 'flow:reserve#hold');
    if (added === undefined) throw new Error('no row');
    expect(rowTitle(added, 'asIs')).toBe(added.after?.action);
  });
});

describe('sideContent', () => {
  it('compares the recorded value of changed behaviour', () => {
    const { comparison, row } = rowOf(invoice, flow, render);
    const logic = row.evidence.find((e) => e.kind === 'step' && e.property === 'logic');
    if (logic === undefined) throw new Error('no logic evidence');
    expect(sideContent({ row, comparison }, logic, 'before')).toEqual({
      kind: 'value',
      value: logic.before,
    });
    expect(sideContent({ row, comparison }, logic, 'after')).toEqual({
      kind: 'value',
      value: logic.after,
    });
  });

  it('does not borrow a step the view lacks', () => {
    const { comparison, row } = rowOf(stock, 'flow:reserve', 'flow:reserve#hold');
    expect(sideContent({ row, comparison }, null, 'before')).toEqual({
      kind: 'text',
      text: 'This step does not exist in this view.',
    });
    expect(sideContent({ row, comparison }, null, 'after').kind).toBe('prose');
  });

  it('says where a step sits in the flow before and after', () => {
    const { comparison, row } = rowOf(stock, 'flow:reserve', 'flow:reserve#create');
    const order = {
      kind: 'order' as const,
      target: row.id,
      property: 'order',
      before: 1,
      after: 3,
      indirect: false,
    };
    const after = sideContent({ row, comparison }, order, 'after');
    expect(after).toMatchObject({ kind: 'text' });
    expect(after.kind === 'text' ? after.text : '').toMatch(/^After /);
  });

  it('keeps a field list to the fields that differ', () => {
    const item = {
      kind: 'record' as const,
      target: 'sch:order',
      property: 'fields',
      indirect: true,
      before: [
        { id: 'a', name: 'a', type: 'string' },
        { id: 'b', name: 'b', type: 'string' },
      ],
      after: [
        { id: 'a', name: 'a', type: 'string' },
        { id: 'b', name: 'b', type: 'number' },
        { id: 'c', name: 'c', type: 'string' },
      ],
    };
    const focused = focusedEvidence(item);
    expect(focused.before).toEqual([{ id: 'b', name: 'b', type: 'string' }]);
    expect(focused.after).toEqual([
      { id: 'b', name: 'b', type: 'number' },
      { id: 'c', name: 'c', type: 'string' },
    ]);
    expect(focusedEvidence({ ...item, before: 'x' }).before).toBe('x');
  });
});

describe('comparisonOf', () => {
  it('puts the changed behaviour first, as the two sides', () => {
    const { comparison, row } = rowOf(invoice, flow, render);
    const view = comparisonOf(invoice, comparison, { row, mode: 'toBe' });
    expect(view.kind).toBe('changed');
    expect(view.name).toBe(row.after?.action);
    expect(view.lead.kind).toBe('cells');
    expect(view.changes.length).toBeGreaterThan(0);
  });

  it('shows only the other side when the step view already says one', () => {
    const { comparison, row } = rowOf(invoice, flow, render);
    const view = comparisonOf(invoice, comparison, { row, mode: 'toBe' });
    const lead = view.lead;
    if (lead.kind !== 'cells') throw new Error('no cells');
    expect(lead.cells.kind).toBe('counterpart');
  });

  it('leaves out the change that is already the headline, but keeps its decisions', () => {
    const { comparison, row } = rowOf(invoice, flow, render);
    const [change] = row.changes;
    if (change === undefined) throw new Error('no change');
    const view = comparisonOf(invoice, comparison, { row, mode: 'toBe', omitChange: change });
    expect(view.changes).not.toContain(change);
    expect(view.decisions).toEqual(
      comparisonOf(invoice, comparison, { row, mode: 'toBe' }).decisions,
    );
  });

  it('says a deprecated step still works, and why', () => {
    const { comparison, row } = rowOf(invoice, flow, `${flow}#reissue`);
    const view = comparisonOf(invoice, comparison, { row, mode: 'toBe' });
    expect(view.lead.kind).toBe('deprecated');
  });

  it('infers an unchanged step from related data without asserting different behaviour', () => {
    const comparison = journeyComparison(invoice, flow);
    const row = comparison.rows.find(
      (r) => r.kind === 'same' && r.evidence.some((e) => e.kind === 'record'),
    );
    if (row === undefined) throw new Error('no related row');
    const view = comparisonOf(invoice, comparison, { row, mode: 'asIs' });
    expect(view.note).toMatch(/^Impact inferred/);
  });

  it('gives an added step seen today the plan’s side', () => {
    const { comparison, row } = rowOf(stock, 'flow:reserve', 'flow:reserve#hold');
    const view = comparisonOf(stock, comparison, { row, mode: 'asIs' });
    expect(view.lead).toMatchObject({ kind: 'absent', mode: 'toBe' });
  });
});

describe('outlineOf', () => {
  it('lists the steps of the view in order, marked', () => {
    const comparison = journeyComparison(invoice, flow);
    const items = outlineOf(invoice, comparison, 'toBe');
    const steps = items.filter((i) => i.kind === 'step');
    expect(steps.map((s) => s.id)).toEqual(comparison.afterFlow?.steps.map((s) => s.id));
    expect(steps.map((s) => s.n)).toEqual(steps.map((_, i) => i + 1));
    expect(steps.find((s) => s.id === render)?.marker).not.toBe('');
  });

  it('shows the steps today lacks beside the step they follow', () => {
    const comparison = journeyComparison(stock, 'flow:reserve');
    const items = outlineOf(stock, comparison, 'asIs');
    const at = items.findIndex((i) => i.kind === 'gap');
    expect(at).toBeGreaterThan(0);
    const gap = items[at];
    expect(gap?.kind === 'gap' ? gap.label : '').toBe('Added here with this plan');
    const added = comparison.rows.filter((r) => r.kind === 'added').map((r) => r.id);
    const shown = items.flatMap((i) => (i.kind === 'gap' ? i.rows.map((r) => r.id) : []));
    expect(shown.toSorted((a, b) => a.localeCompare(b))).toEqual(
      added.toSorted((a, b) => a.localeCompare(b)),
    );
  });

  it('has no steps for a flow the view lacks', () => {
    const comparison = journeyComparison(stock, 'flow:abandon');
    expect(outlineOf(stock, comparison, 'asIs').filter((i) => i.kind === 'step')).toEqual([]);
  });
});

describe('absenceOf', () => {
  it('says a new flow does not exist today, and removed ones are removed', () => {
    const added = journeyComparison(stock, 'flow:abandon').rows[0];
    const removed = journeyComparison(stock, 'flow:oversell-report').rows[0];
    if (added === undefined || removed === undefined) throw new Error('no rows');
    const today = absenceOf(stock, 'flow:abandon', { stepId: added.id, mode: 'asIs' });
    expect(today.claim).toBe('This flow does not exist today.');
    expect(today.counterpart).toBe('toBe');
    const planned = absenceOf(stock, 'flow:oversell-report', { stepId: removed.id, mode: 'toBe' });
    expect(planned.claim).toBe('This flow is removed with this plan.');
    expect(planned.counterpart).toBe('asIs');
  });

  it('keeps an added step its own, with the steps that survive around it', () => {
    const view = absenceOf(stock, 'flow:reserve', { stepId: 'flow:reserve#hold', mode: 'asIs' });
    expect(view.claim).toBe('This step is added with this plan.');
    expect(view.stepId).toBe('flow:reserve#hold');
    expect(view.steps.map((s) => s.label.split(':')[0])).toEqual([
      'Previous surviving step',
      'Next surviving step',
    ]);
  });

  it('never picks the first step for one it does not know', () => {
    const view = absenceOf(invoice, flow, { stepId: `${flow}#unknown`, mode: 'asIs' });
    expect(view.claim).toBe('This step is not recorded in this flow.');
    expect(view.title).toBeNull();
  });
});

describe('rolloutNotes', () => {
  it('has none for a step the plan does not remove or deprecate', () => {
    expect(rolloutNotes(invoice, flow, render)).toEqual([]);
  });

  it('collects the notes of the changes that remove or deprecate it', () => {
    const plan = structuredClone(invoice.plan);
    plan.changes = [
      ...(plan.changes ?? []),
      {
        id: 'chg:wind-down',
        title: 'Wind down',
        rollout: 'Keep it on for a week.',
        ops: [{ deprecate: `${flow}#reissue` }],
      },
    ];
    expect(rolloutNotes(derive(plan), flow, `${flow}#reissue`)).toContain('Keep it on for a week.');
  });
});
