// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';
import { domainView, namesPlan } from '@/application/plan-viz-domain';
import { PLANS } from '@/features/plan/chapters/chapter-kit';

import { ConceptCards } from './concept-cards';
import { Names } from './names';

vi.mock('server-only', () => ({}));

const { planData } = await import('@/infrastructure/plan-data');

async function modelOf(plan: string) {
  const data = await planData({ workspace: 'alder-finch', plan });
  if (data === null) throw new Error(`no plan ${plan}`);
  return data.model;
}

afterEach(cleanup);

describe('domain views', () => {
  it.each(PLANS)('draws a card per concept of %s, or nothing', async (plan) => {
    const model = await modelOf(plan);
    const { container } = render(<ConceptCards model={model} />);
    expect(container.querySelectorAll('li[class*="card"]')).toHaveLength(
      model.plan.domain?.concepts?.length ?? 0,
    );
  });

  it.each(PLANS)('keeps what the plan introduces out of today in %s', async (plan) => {
    const model = await modelOf(plan);
    const today = domainView(model, true);
    const all = domainView(model, false);
    expect(today.concepts.length + today.added.length).toBe(all.concepts.length);
    const { container } = render(<ConceptCards model={model} today />);
    expect(container.textContent).not.toContain('new in this plan');
  });

  it.each(PLANS)('says what each system calls the same thing in %s', async (plan) => {
    const model = await modelOf(plan);
    const names = namesPlan(model, domainView(model, true));
    const { container } = render(<Names model={model} today />);
    if (names.kind === 'none') expect(container.textContent).toBe('');
    if (names.kind === 'table')
      expect(container.querySelectorAll('tbody tr')).toHaveLength(names.rows.length);
    if (names.kind === 'lines')
      expect(container.querySelectorAll('li')).toHaveLength(names.lines.length);
  });

  it('draws a table when two concepts are named in the same systems', async () => {
    const model = await modelOf('storefront-graph');
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
    const own = derive(plan);
    const { container } = render(<Names model={own} />);
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(container.querySelector('td[data-born]')).not.toBeNull();
    expect(container.querySelector('button[data-inspect]')).not.toBeNull();
  });
});
