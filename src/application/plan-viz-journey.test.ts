import { describe, expect, it } from 'vitest';

import { reworkCheckout } from '@/../test/fixtures/acme/plans/contracts-rework-checkout';
import { modelOf } from '@/../test/plan-kit';
import { derive } from '@/application/plan/derive';
import { journeyComparison } from '@/application/plan/journey';
import { comparisonOf } from '@/application/plan-viz-journey-compare';
import { absenceOf, outlineOf, rolloutNotes } from '@/application/plan-viz-journey-outline';
import { focusedEvidence, sideContent } from '@/application/plan-viz-journey-sides';
import { journeyMarkerText, modeOf, rowTitle } from '@/application/plan-viz-journey-words';

const plan = modelOf(reworkCheckout());

const flow = 'flow:place-order';
const render = `${flow}#email`;
const card = `${flow}#card`;
const publish = 'flow:publish-product';
const check = `${publish}#check`;
const added = 'flow:pause-order';
const removed = 'flow:cancel-order';

const rowOf = (model: typeof plan, flowId: string, id: string) => {
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
    const { row } = rowOf(plan, flow, `${flow}#submit`);
    expect(journeyMarkerText(row, 'asIs')).toBe('Screen layout changes');
  });

  it('says a deprecated step is deprecated with the plan, today, and still works, in the plan', () => {
    const { row } = rowOf(plan, flow, card);
    expect(journeyMarkerText(row, 'asIs')).toBe('Deprecated with this plan · still works');
    expect(journeyMarkerText(row, 'toBe')).toBe('Deprecated · still works');
  });

  it('says nothing for a step that runs as today', () => {
    const { comparison } = rowOf(plan, flow, render);
    const same = comparison.rows.find((r) => r.kind === 'same' && r.evidence.length === 0);
    expect(journeyMarkerText(same, 'toBe')).toBe('');
    expect(journeyMarkerText(null, 'toBe')).toBe('');
  });

  it('names a step by its action in the chosen view, else the other', () => {
    const { comparison } = rowOf(plan, publish, check);
    const row = comparison.rows.find((r) => r.id === check);
    if (row === undefined) throw new Error('no row');
    expect(row.before).toBeNull();
    expect(rowTitle(row, 'asIs')).toBe(row.after?.action);
  });
});

describe('sideContent', () => {
  it('compares the recorded value of changed behaviour', () => {
    const { comparison, row } = rowOf(plan, flow, render);
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
    const { comparison, row } = rowOf(plan, publish, check);
    expect(sideContent({ row, comparison }, null, 'before')).toEqual({
      kind: 'text',
      text: 'This step does not exist in this view.',
    });
    expect(sideContent({ row, comparison }, null, 'after').kind).toBe('prose');
  });

  it('says where a step sits in the flow before and after', () => {
    const { comparison, row } = rowOf(plan, publish, `${publish}#announce`);
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
    expect(after.kind === 'text' ? after.text : '').toMatch(/^After /u);
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
    const { comparison, row } = rowOf(plan, flow, render);
    const view = comparisonOf(plan, comparison, { row, mode: 'toBe' });
    expect(view.kind).toBe('changed');
    expect(view.name).toBe(row.after?.action);
    expect(view.lead.kind).toBe('cells');
    expect(view.changes.length).toBeGreaterThan(0);
  });

  it('shows only the other side when the step view already says one', () => {
    const { comparison, row } = rowOf(plan, flow, render);
    const view = comparisonOf(plan, comparison, { row, mode: 'toBe' });
    const lead = view.lead;
    if (lead.kind !== 'cells') throw new Error('no cells');
    expect(lead.cells.kind).toBe('counterpart');
  });

  it('leaves out the change that is already the headline, but keeps its decisions', () => {
    const { comparison, row } = rowOf(plan, flow, render);
    const [change] = row.changes;
    if (change === undefined) throw new Error('no change');
    const view = comparisonOf(plan, comparison, { row, mode: 'toBe', omitChange: change });
    expect(view.changes).not.toContain(change);
    expect(view.decisions).toEqual(comparisonOf(plan, comparison, { row, mode: 'toBe' }).decisions);
  });

  it('says a deprecated step still works, and why', () => {
    const { comparison, row } = rowOf(plan, flow, card);
    const view = comparisonOf(plan, comparison, { row, mode: 'toBe' });
    expect(view.lead.kind).toBe('deprecated');
  });

  it('infers an unchanged step from related data without asserting different behaviour', () => {
    const comparison = journeyComparison(plan, flow);
    const row = comparison.rows.find(
      (r) => r.kind === 'same' && r.evidence.some((e) => e.kind === 'record'),
    );
    if (row === undefined) throw new Error('no related row');
    const view = comparisonOf(plan, comparison, { row, mode: 'asIs' });
    expect(view.note).toMatch(/^Impact inferred/u);
  });

  it('gives an added step seen today the plan’s side', () => {
    const { comparison, row } = rowOf(plan, publish, check);
    const view = comparisonOf(plan, comparison, { row, mode: 'asIs' });
    expect(view.lead).toMatchObject({ kind: 'absent', mode: 'toBe' });
  });
});

describe('outlineOf', () => {
  it('lists the steps of the view in order, marked', () => {
    const comparison = journeyComparison(plan, flow);
    const items = outlineOf(plan, comparison, 'toBe');
    const steps = items.filter((i) => i.kind === 'step');
    expect(steps.map((s) => s.id)).toEqual(comparison.afterFlow?.steps.map((s) => s.id));
    expect(steps.map((s) => s.n)).toEqual(steps.map((_, i) => i + 1));
    expect(steps.find((s) => s.id === render)?.marker).not.toBe('');
  });

  it('shows the steps today lacks beside the step they follow', () => {
    const comparison = journeyComparison(plan, publish);
    const items = outlineOf(plan, comparison, 'asIs');
    const at = items.findIndex((i) => i.kind === 'gap');
    expect(at).toBeGreaterThan(0);
    const gap = items[at];
    expect(gap?.kind === 'gap' ? gap.label : '').toBe('Added here with this plan');
    const fresh = comparison.rows.filter((r) => r.kind === 'added').map((r) => r.id);
    const shown = items.flatMap((i) => (i.kind === 'gap' ? i.rows.map((r) => r.id) : []));
    expect(fresh).toEqual([check]);
    expect(shown).toEqual(fresh);
  });

  it('has no steps for a flow the view lacks', () => {
    const comparison = journeyComparison(plan, added);
    expect(outlineOf(plan, comparison, 'asIs').filter((i) => i.kind === 'step')).toEqual([]);
  });
});

describe('absenceOf', () => {
  it('says a new flow does not exist today, and removed ones are removed', () => {
    const first = journeyComparison(plan, added).rows[0];
    const gone = journeyComparison(plan, removed).rows[0];
    if (first === undefined || gone === undefined) throw new Error('no rows');
    const today = absenceOf(plan, added, { stepId: first.id, mode: 'asIs' });
    expect(today.claim).toBe('This flow does not exist today.');
    expect(today.counterpart).toBe('toBe');
    const planned = absenceOf(plan, removed, { stepId: gone.id, mode: 'toBe' });
    expect(planned.claim).toBe('This flow is removed with this plan.');
    expect(planned.counterpart).toBe('asIs');
  });

  it('keeps an added step its own, with the steps that survive around it', () => {
    const view = absenceOf(plan, publish, { stepId: check, mode: 'asIs' });
    expect(view.claim).toBe('This step is added with this plan.');
    expect(view.stepId).toBe(check);
    expect(view.steps.map((s) => s.label.split(':')[0])).toEqual([
      'Previous surviving step',
      'Next surviving step',
    ]);
  });

  it('never picks the first step for one it does not know', () => {
    const view = absenceOf(plan, flow, { stepId: `${flow}#unknown`, mode: 'asIs' });
    expect(view.claim).toBe('This step is not recorded in this flow.');
    expect(view.title).toBeNull();
  });
});

describe('rolloutNotes', () => {
  it('has none for a step the plan does not remove or deprecate', () => {
    expect(rolloutNotes(plan, flow, render)).toEqual([]);
  });

  it('collects the notes of the changes that remove or deprecate it', () => {
    expect(rolloutNotes(plan, flow, card)).toEqual([
      'Keep the direct charge for a week behind a switch.',
    ]);
    const more = structuredClone(plan.plan);
    more.changes = [
      ...(more.changes ?? []),
      {
        id: 'chg:wind-down',
        title: 'Wind down',
        rollout: 'Keep it on for a week.',
        ops: [{ deprecate: card }],
      },
    ];
    expect(rolloutNotes(derive(more), flow, card)).toEqual([
      'Keep the direct charge for a week behind a switch.',
      'Keep it on for a week.',
    ]);
  });
});
