// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { shop } from '@/../test/federation-kit';
import { pauseOrders } from '@/../test/fixtures/acme/plans/pause-orders';
import { checkoutContracts } from '@/../test/fixtures/acme/plans/work-contracts';
import { dispatchDate } from '@/../test/fixtures/acme/plans/work-dispatch';
import { modelOf } from '@/../test/plan-kit';
import { type NamesPlan, domainView, namesPlan } from '@/application/plan-viz-domain';

import { ConceptCards } from './concept-cards';
import { Names } from './names';

const PLANS = [
  ['dispatch-date', dispatchDate],
  ['pause-orders', pauseOrders],
  ['checkout-contracts', checkoutContracts],
  ['shop', shop],
] as const;

// What the names view drew against what the plan for it says it should: rows, lines, or nothing at all.
function namesShown(container: HTMLElement, names: NamesPlan) {
  if (names.kind === 'table') {
    return { drawn: container.querySelectorAll('tbody tr').length, wanted: names.rows.length };
  }
  if (names.kind === 'lines') {
    return { drawn: container.querySelectorAll('li').length, wanted: names.lines.length };
  }
  return { drawn: container.textContent.length, wanted: 0 };
}

afterEach(cleanup);

describe('domain views', () => {
  it.each(PLANS)('draws a card per concept of %s, or nothing', (_, plan) => {
    const model = modelOf(plan());
    const { container } = render(<ConceptCards model={model} />);
    expect(container.querySelectorAll('li[class*="card"]')).toHaveLength(
      model.plan.domain?.concepts?.length ?? 0,
    );
  });

  it.each(PLANS)('keeps what the plan introduces out of today in %s', (_, plan) => {
    const model = modelOf(plan());
    const today = domainView(model, true);
    const all = domainView(model, false);
    expect(today.concepts.length + today.added.length).toBe(all.concepts.length);
    const { container } = render(<ConceptCards model={model} today />);
    expect(container.textContent).not.toContain('new in this plan');
  });

  it.each(PLANS)('says what each system calls the same thing in %s', (_, plan) => {
    const model = modelOf(plan());
    const names = namesPlan(model, domainView(model, true));
    const { container } = render(<Names model={model} today />);
    const { drawn, wanted } = namesShown(container, names);
    expect(drawn).toBe(wanted);
  });

  it('names a concept in each system that calls it something else', () => {
    const model = modelOf(dispatchDate());
    const names = namesPlan(model, domainView(model, false));
    expect(names.kind).toBe('lines');
    expect(names.lines.map((l) => [l.id, l.names.map((n) => n.as)])).toEqual([
      ['con:product', ['SearchDoc']],
      ['con:dispatch-date', ['dispatch_days']],
    ]);
    expect(domainView(model, true).added.map((c) => c.id)).toEqual(['con:dispatch-date']);
    const { container } = render(<ConceptCards model={model} />);
    expect(container.textContent).toContain('new in this plan');
  });

  it('draws a table when two concepts are named in the same systems', () => {
    const model = modelOf(dispatchDate());
    const [a, b] = model.asIs.services.map((x) => x.id);
    if (a === undefined || b === undefined) throw new Error('needs two systems');
    const concept = (id: string, name: string) => ({
      id: `con:${id}`,
      name,
      means: 'A thing.',
      born_in: a,
      aka: [
        { in: a, as: name },
        { in: b, as: `${name}View`, at: a },
      ],
    });
    const plan = {
      ...model.plan,
      domain: { concepts: [concept('one', 'One'), concept('two', 'Two')] },
    };
    const own = modelOf(plan);
    const { container } = render(<Names model={own} />);
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(container.querySelector('td[data-born]')).not.toBeNull();
    expect(container.querySelector('button[data-inspect]')).not.toBeNull();
  });
});
