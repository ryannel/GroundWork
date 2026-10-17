// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';

import { TintedDocument } from './tinted-document';
import { Waterfall } from './waterfall';

vi.mock(import('server-only'), () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');
const { shop } = await import('@/../test/federation-kit');

const model = derive(await loadFixture('shop.yaml'));
const cart = derive(shop());

afterEach(cleanup);

const body = (container: HTMLElement, kase: string) =>
  container.querySelector<HTMLElement>(`[data-case-of="${kase}"]`);

describe('Waterfall', () => {
  it('draws nothing for something that is not an operation with a plan', () => {
    const { container } = render(<Waterfall id="sys:storefront" model={model} />);
    expect(container.innerHTML).toBe('');
  });

  it('draws every case under a control, opening on the first the plan lands on', () => {
    const { container } = render(<Waterfall id="gql:product-page" model={model} />);
    const group = screen.getByRole('group', { name: 'Case' });
    const buttons = within(group).getAllByRole('button');
    expect(buttons).toHaveLength(3);
    expect(container.querySelectorAll('[data-case-of]')).toHaveLength(3);
    const section = container.querySelector<HTMLElement>('[data-waterfall]');
    const pressed = buttons.find((b) => b.getAttribute('aria-pressed') === 'true');
    expect(section?.dataset.case).toBeTruthy();
    expect(pressed).toBeDefined();
  });

  it('switches the case it shows when a case is chosen', () => {
    const { container } = render(<Waterfall id="gql:product-page" model={model} />);
    const section = container.querySelector<HTMLElement>('[data-waterfall]');
    const buttons = within(screen.getByRole('group', { name: 'Case' })).getAllByRole('button');
    const [first] = buttons;
    const last = buttons.at(-1);
    fireEvent.click(last ?? first ?? document.body);
    expect(section?.dataset.case).toBe('cold');
    expect(last?.getAttribute('aria-pressed')).toBe('true');
    expect(first?.getAttribute('aria-pressed')).toBe('false');
  });

  it('draws a row for each layer, the gateway, each fetch and the fill, in order', () => {
    const { container } = render(<Waterfall id="gql:product-page" kase="cold" model={model} />);
    const kinds = [
      ...(body(container, 'cold')?.querySelectorAll<HTMLElement>('li[data-kind]') ?? []),
    ].map((li) => li.dataset.kind);
    expect(kinds[0]).toBe('cache');
    expect(kinds).toContain('hinge');
    expect(kinds.filter((k) => k === 'fetch')).toHaveLength(4);
    expect(kinds.at(-1)).toBe('fill');
    const bands = body(container, 'cold')?.querySelectorAll('ol > li:not([data-kind])');
    expect(bands?.length).toBe(3);
  });

  it('gives each fetch the subgraph that answers it, the fields it returns and a way to open them', () => {
    const { container } = render(<Waterfall id="gql:product-page" kase="cold" model={model} />);
    const fetch = body(container, 'cold')?.querySelector('li[data-kind="fetch"]');
    expect(fetch?.querySelector('button[data-inspect]')).not.toBeNull();
    expect(fetch?.textContent).toContain('returns');
    expect(fetch?.querySelector('svg rect')).not.toBeNull();
  });

  it('marks a layer that answered, and what it cannot keep', () => {
    const { container } = render(<Waterfall id="gql:product-page" kase="hit" model={model} />);
    const edge = body(container, 'hit')?.querySelector<HTMLElement>('li[data-kind="cache"]');
    expect(edge?.dataset.state).toBe('hit');
    expect(edge?.textContent).toMatch(/hit/u);
    const blocked = render(<Waterfall id="gql:cart-summary" mode="asIs" model={cart} />);
    expect(blocked.container.querySelector('li[data-state="blocked"] s')).not.toBeNull();
    expect(blocked.container.textContent).toContain('is private, so it is for one person');
  });

  it('says what a partial hit answers per fetch', () => {
    const { container } = render(
      <Waterfall id="gql:cart-summary" kase="hit" mode="asIs" model={cart} />,
    );
    expect(container.textContent).toContain('answers some');
    expect(container.querySelector('li[data-kind="cache"] [data-state="hit"]')).not.toBeNull();
  });

  it('tags a batched fetch, and one that runs a query for each item', () => {
    const { container } = render(
      <Waterfall id="gql:search-reviews" kase="cold" mode="asIs" model={cart} />,
    );
    expect(
      container.querySelector('[title^="One call carries"],[title^="No batching"]'),
    ).not.toBeNull();
  });

  it('draws one case and no control when compact', () => {
    const { container } = render(<Waterfall compact id="gql:product-page" model={model} />);
    expect(screen.queryByRole('group', { name: 'Case' })).toBeNull();
    expect(container.querySelectorAll('[data-case-of]')).toHaveLength(1);
    expect(container.querySelector('[data-compact]')).not.toBeNull();
  });

  it('says a mutation is never cached, and draws no control', () => {
    const { container } = render(<Waterfall id="gql:add-to-cart" model={cart} />);
    expect(container.textContent).toContain('mutations are never cached');
    expect(screen.queryByRole('group', { name: 'Case' })).toBeNull();
  });

  it('marks what a plan adds, moves and removes against today', () => {
    const { container } = render(<Waterfall diff id="gql:product-page" model={model} />);
    const changes = [...container.querySelectorAll<HTMLElement>('li[data-change]')].map(
      (li) => li.dataset.change,
    );
    expect(container.textContent).toContain('with this plan');
    expect(changes.every((c) => c === 'add' || c === 'moved' || c === 'gone')).toBe(true);
  });

  it('keeps a team’s fetches and fades the others', () => {
    const { container } = render(
      <Waterfall id="gql:product-page" kase="cold" lens="team:catalogue" model={model} />,
    );
    const lens = [...container.querySelectorAll<HTMLElement>('li[data-kind="fetch"]')].map(
      (li) => li.dataset.lens,
    );
    expect(lens.every((l) => l === 'mine' || l === 'faded')).toBe(true);
  });

  it('qualifies the summary with a derived estimate until the registry backs the plan', () => {
    const { container } = render(<Waterfall id="gql:product-page" model={model} />);
    expect(container.querySelector('[data-facts="registry estimated"]')).not.toBeNull();
  });
});

describe('TintedDocument', () => {
  it('tints each field name with the team that answers it', () => {
    const { container } = render(<TintedDocument id="gql:product-page" model={model} />);
    const names = container.querySelectorAll('pre span[data-slot]');
    expect(names.length).toBeGreaterThan(2);
    expect(names[0]?.getAttribute('title')).toBeTruthy();
    expect(container.querySelector('pre')?.textContent).toContain('query');
  });

  it('draws nothing for what has no document', () => {
    const { container } = render(<TintedDocument id="sys:storefront" model={model} />);
    expect(container.innerHTML).toBe('');
  });
});
