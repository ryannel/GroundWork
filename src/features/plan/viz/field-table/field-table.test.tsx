// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { deliveryTime } from '@/../test/fixtures/acme/plans/contracts-delivery-time';
import { modelOf } from '@/../test/plan-kit';
import { schemaCounts } from '@/application/plan-viz-fields';
import { FieldTable } from '@/features/plan/viz/field-table/field-table';
import { CountsLine, FieldLegend, SchemaHead } from '@/features/plan/viz/field-table/schema-head';

const model = modelOf(deliveryTime());
const PRODUCT = 'sch:product';

afterEach(cleanup);

describe('FieldTable', () => {
  it('marks what the plan changes, keeps the old type and says who must move', () => {
    const { container } = render(<FieldTable model={model} schemaId={PRODUCT} who />);
    const rows = [...container.querySelectorAll<HTMLElement>('tbody tr[data-status]')];
    expect(rows.map((r) => r.dataset.status)).toEqual([
      'existing',
      'modified',
      'added',
      'added',
      'added',
      'removed',
    ]);
    expect(container.textContent).toContain('lead_days');
    expect(container.querySelector('[data-schema="sch:product"]')).not.toBeNull();
    expect(container.textContent).toMatch(/Breaks|Moves|Check service readers/u);
  });

  it('puts the field that breaks readers first when asked', () => {
    const { container } = render(<FieldTable model={model} order="worst" schemaId={PRODUCT} />);
    const first = container.querySelector<HTMLElement>(
      'tbody tr[data-status] button[data-inspect]',
    );
    expect(first?.dataset.inspect).toBe('sch:product#name');
  });

  it('shows one field of a schema', () => {
    const { container } = render(
      <FieldTable model={model} only={['weight_g']} schemaId={PRODUCT} />,
    );
    expect(container.querySelectorAll('tbody tr[data-status]')).toHaveLength(1);
  });

  it('draws as-is without marks and with a title line when asked', () => {
    render(<FieldTable head mode="asIs" model={model} schemaId={PRODUCT} />);
    expect(screen.getByRole('button', { name: 'Product' })).toBeDefined();
    expect(document.querySelector('td[aria-label="unchanged"]')).not.toBeNull();
  });

  it('says nothing for something that is not a schema', () => {
    const { container } = render(<FieldTable model={model} schemaId="sch:nothing" />);
    expect(container.innerHTML).toBe('');
  });

  it('folds all but the new rows in chapter 4 and unfolds on a click', () => {
    render(<FieldTable fold="existing" model={model} schemaId={PRODUCT} />);
    const more = screen.getAllByRole('button', { name: /existing field/u })[0]!;
    expect(more.getAttribute('aria-expanded')).toBe('false');
    const before = document.querySelectorAll('tbody tr[data-status]').length;
    fireEvent.click(more);
    expect(document.querySelectorAll('tbody tr[data-status]').length).toBeGreaterThan(before);
  });
});

describe('SchemaHead, CountsLine and FieldLegend', () => {
  it('gives the name, the size, the counts and the verdict', () => {
    const { container } = render(<SchemaHead model={model} schemaId={PRODUCT} />);
    expect(container.textContent).toMatch(/fields?/u);
    expect(container.querySelector('[data-compat]')).not.toBeNull();
  });

  it('spells the counts out, or says nothing changed', () => {
    const counts = schemaCounts(model, PRODUCT);
    const { container, rerender } = render(<CountsLine counts={counts} />);
    expect(container.textContent).toMatch(/new|changed|deprecated|removed/u);
    rerender(
      <CountsLine counts={{ ...counts, added: 0, modified: 0, deprecated: 0, removed: 0 }} />,
    );
    expect(container.textContent).toBe('no field changes');
  });

  it('keeps only the marks that appear', () => {
    const counts = {
      ...schemaCounts(model, PRODUCT),
      added: 0,
      modified: 1,
      deprecated: 0,
      removed: 0,
    };
    const { container, rerender } = render(<FieldLegend counts={counts} />);
    expect(container.textContent).toContain('changed');
    expect(container.textContent).not.toContain('removed');
    rerender(<FieldLegend />);
    expect(container.textContent).toContain('removed');
  });
});
