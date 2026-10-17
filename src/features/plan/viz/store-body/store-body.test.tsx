// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { deliveryTime } from '@/../test/fixtures/acme/plans/contracts-delivery-time';
import { modelOf } from '@/../test/plan-kit';
import {
  accessRows,
  recordsOf,
  relationships,
  shortTech,
  storeGlance,
} from '@/application/plan-viz-store';
import { StoreBody } from '@/features/plan/viz/store-body/store-body';

afterEach(cleanup);

const model = modelOf(deliveryTime());

describe('store records', () => {
  it('keeps the first phrase of the technology', () => {
    expect(shortTech('PostgreSQL via EF Core; JSONB')).toBe('PostgreSQL');
    expect(shortTech('`Redis` plus Sentinel')).toBe('Redis');
    expect(shortTech()).toBe('');
  });

  it('reads a store’s records, who uses it and how they relate', () => {
    expect(recordsOf(model, 'st:delivery-times', 'toBe').map((s) => s.id)).toEqual([
      'sch:delivery-time',
    ]);
    expect(recordsOf(model, 'st:delivery-times', 'asIs')).toEqual([]);
    expect(recordsOf(model, 'st:search-index').every((s) => s.store === 'st:search-index')).toBe(
      true,
    );
    expect(relationships(model, 'st:search-index')).toEqual([]);
    expect(accessRows(model, 'st:search-index').map((r) => r.role)).toEqual(['owner', 'reads']);
    expect(storeGlance(model, 'st:search-index')).toMatchObject({
      tech: 'OpenSearch',
      owner: 'svc:search-indexer',
      records: 1,
      readers: 1,
    });
    expect(storeGlance(model, 'st:delivery-times')).toMatchObject({
      tech: 'Postgres 16',
      owner: 'svc:products',
      records: 1,
    });
    expect(storeGlance(model, 'st:nope')).toBeNull();
  });
});

describe('store body', () => {
  it('draws the glance, records and access of a database', () => {
    const { container } = render(<StoreBody id="st:search-index" model={model} />);
    expect(container.textContent).toContain('At a glance');
    expect(container.querySelectorAll('details').length).toBeGreaterThan(0);
    expect(container.textContent).toContain('Records');
  });

  it('shows a slot for the events on a topic and none of the records', () => {
    const { container } = render(
      <StoreBody id="st:product-events" model={model} topicEvents={<i>events here</i>} />,
    );
    expect(container.textContent).toContain('Events on this topic');
    expect(container.textContent).toContain('events here');
    expect(container.textContent).not.toContain('Records');
  });

  it('draws nothing for an id that is not a store', () => {
    const { container } = render(<StoreBody id="svc:nope" model={model} />);
    expect(container.textContent).toBe('');
  });
});
