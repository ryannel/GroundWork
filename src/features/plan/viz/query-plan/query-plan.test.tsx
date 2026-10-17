// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { shop } from '@/../test/federation-kit';
import { modelOf } from '@/../test/plan-kit';
import { planFacts, planOf, roundsOf, selectionOf, WHY } from '@/application/plan-viz-query-plan';

import { QueryPlanTree } from './query-plan-tree';
import { SegTabs } from './seg-tabs.client';

afterEach(cleanup);

const load = () => modelOf(shop());

const OP = 'gql:product-page';

describe('the query plan of an operation', () => {
  it('draws rounds and the fetches in them', () => {
    const model = load();
    const plan = planOf(model, OP);
    if (plan === null) throw new Error('no plan');
    expect(plan.fetches).toHaveLength(4);
    const rounds = roundsOf(plan);
    expect(rounds.flat()).toHaveLength(plan.fetches.length);
    expect(planFacts(model, OP)).toContain('Fetch');
  });

  it('is empty for an unknown operation', () => {
    const model = load();
    expect(planOf(model, 'gql:nothing')).toBeNull();
    expect(planFacts(model, 'gql:nothing')).toBe('');
  });

  it('nests the selection and marks the names the gateway added', () => {
    const model = load();
    const plan = planOf(model, OP);
    if (plan === null) throw new Error('no plan');
    const nodes = plan.fetches.flatMap((f) => selectionOf(plan, f));
    expect(nodes.length).toBeGreaterThan(0);
    expect(Object.keys(WHY)).toEqual(['key', 'requires']);
  });

  it('renders the tree with the facts the other surfaces agree with', () => {
    const model = load();
    const { container } = render(<QueryPlanTree model={model} opId={OP} />);
    const root = container.querySelector<HTMLElement>('[data-facts-of]');
    expect(root!.dataset.factsOf).toBe(OP);
    expect(root!.dataset.facts).toBe(planFacts(model, OP));
    expect(container.querySelectorAll('[data-fetch]').length).toBeGreaterThan(0);
  });

  it('says Flatten only for a fetch that folds into a result above it', () => {
    const model = load();
    const plan = planOf(model, OP);
    const { container } = render(<QueryPlanTree model={model} opId={OP} />);
    const folds = plan?.fetches.filter((f) => f.kind === 'entity' && f.path !== '').length ?? 0;
    expect(folds).toBeGreaterThan(0);
    expect(container.textContent.split('Flatten')).toHaveLength(folds + 1);
  });

  it('renders nothing when there is no plan', () => {
    const model = load();
    const { container } = render(<QueryPlanTree model={model} opId="gql:nothing" />);
    expect(container.innerHTML).toBe('');
  });
});

describe('the segmented tabs', () => {
  const tabs = [
    { label: 'Plan', content: <p>the plan</p>, action: <button type="button">Copy plan</button> },
    { label: 'Document', content: <p>the document</p> },
  ];

  it('shows the first tab and switches', () => {
    render(<SegTabs label="Show as" tabs={tabs} />);
    expect(screen.getByRole('radiogroup', { name: 'Show as' })).toBeDefined();
    expect(screen.getByText('the plan').parentElement?.hidden).toBe(false);
    expect(screen.getByText('the document').parentElement?.hidden).toBe(true);
    expect(screen.getByRole('button', { name: 'Copy plan' })).toBeDefined();
    fireEvent.click(screen.getByLabelText('Document'));
    expect(screen.getByText('the document').parentElement?.hidden).toBe(false);
    expect(screen.getByText('the plan').parentElement?.hidden).toBe(true);
    expect(screen.queryByRole('button', { name: 'Copy plan' })).toBeNull();
  });

  it('shows a single tab without the control', () => {
    render(<SegTabs label="Show as" tabs={tabs.slice(0, 1)} />);
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(screen.getByText('the plan')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Copy plan' })).toBeDefined();
  });

  it('renders nothing for no tabs', () => {
    const { container } = render(<SegTabs label="Show as" tabs={[]} />);
    expect(container.innerHTML).toBe('');
  });
});
