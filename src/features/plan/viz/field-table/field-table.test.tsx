// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';
import { schemaCounts } from '@/application/plan-viz-fields';
import { FieldTable } from '@/features/plan/viz/field-table/field-table';
import { CountsLine, FieldLegend, SchemaHead } from '@/features/plan/viz/field-table/schema-head';

vi.mock('server-only', () => ({}));

const { readPlan } = await import('@/infrastructure/plan-store');

const loaded = await readPlan('alder-finch', 'delivery-promise');
const model = derive(loaded.plan!);
const PRODUCT = 'sch:product';

afterEach(cleanup);

describe('FieldTable', () => {
  it('marks what the plan changes, keeps the old type and says who must move', () => {
    const { container } = render(<FieldTable model={model} schemaId={PRODUCT} who />);
    const rows = [...container.querySelectorAll<HTMLElement>('tbody tr[data-status]')];
    expect(rows.length).toBeGreaterThan(2);
    expect(rows.some((r) => r.dataset.status !== 'existing')).toBe(true);
    expect(container.textContent).toContain('lead_time_text');
    expect(container.querySelector('[data-schema="sch:product"]')).not.toBeNull();
    expect(container.textContent).toMatch(/Breaks|Moves|Check service readers/);
  });

  it('puts the field that breaks readers first when asked', () => {
    const { container } = render(<FieldTable model={model} order="worst" schemaId={PRODUCT} />);
    const first = container.querySelector<HTMLElement>(
      'tbody tr[data-status] button[data-inspect]',
    );
    expect(first?.dataset.inspect).toBe('sch:product#lead_time_text');
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
    const more = screen.getAllByRole('button', { name: /existing field/ })[0]!;
    expect(more.getAttribute('aria-expanded')).toBe('false');
    const before = document.querySelectorAll('tbody tr[data-status]').length;
    fireEvent.click(more);
    expect(document.querySelectorAll('tbody tr[data-status]').length).toBeGreaterThan(before);
  });
});

describe('SchemaHead, CountsLine and FieldLegend', () => {
  it('gives the name, the size, the counts and the verdict', () => {
    const { container } = render(<SchemaHead model={model} schemaId={PRODUCT} />);
    expect(container.textContent).toMatch(/fields?/);
    expect(container.querySelector('[data-compat]')).not.toBeNull();
  });

  it('spells the counts out, or says nothing changed', () => {
    const counts = schemaCounts(model, PRODUCT);
    const { container, rerender } = render(<CountsLine counts={counts} />);
    expect(container.textContent).toMatch(/new|changed|deprecated|removed/);
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
