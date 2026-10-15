// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';
import {
  accessRows,
  recordsOf,
  relationships,
  shortTech,
  storeGlance,
} from '@/application/plan-viz-store';
import { StoreBody } from '@/features/plan/viz/store-body/store-body';

vi.mock('server-only', () => ({}));

afterEach(cleanup);

async function load(slug = 'delivery-promise') {
  const { readPlan } = await import('@/infrastructure/plan-store');
  const loaded = await readPlan('alder-finch', slug);
  return derive(loaded.plan!);
}

describe('store records', () => {
  it('keeps the first phrase of the technology', () => {
    expect(shortTech('PostgreSQL via EF Core; JSONB')).toBe('PostgreSQL');
    expect(shortTech('`Redis` plus Sentinel')).toBe('Redis');
    expect(shortTech()).toBe('');
  });

  it('reads a store’s records, who uses it and how they relate', async () => {
    const model = await load();
    const db = model.toBe.stores.find((s) => recordsOf(model, s.id).length > 0)!;
    expect(recordsOf(model, db.id, 'toBe').every((s) => s.store === db.id)).toBe(true);
    expect(Array.isArray(relationships(model, db.id))).toBe(true);
    expect(accessRows(model, db.id)[0]?.role).toBeDefined();
    const glance = storeGlance(model, db.id)!;
    expect(glance.records).toBeGreaterThan(0);
    expect(storeGlance(model, 'st:nope')).toBeNull();
  });
});

describe('store body', () => {
  it('draws the glance, records and access of a database', async () => {
    const model = await load();
    const db = model.toBe.stores.find((s) => recordsOf(model, s.id).length > 0)!;
    const { container } = render(<StoreBody id={db.id} model={model} />);
    expect(container.textContent).toContain('At a glance');
    expect(container.querySelectorAll('details').length).toBeGreaterThan(0);
    expect(container.textContent).toContain('Records');
  });

  it('shows a slot for the events on a topic and none of the records', async () => {
    const model = await load();
    const topic = model.toBe.stores.find((s) => s.kind === 'topic' || s.kind === 'queue');
    if (topic === undefined) return;
    const { container } = render(
      <StoreBody id={topic.id} model={model} topicEvents={<i>events here</i>} />,
    );
    expect(container.textContent).toContain('Events on this topic');
    expect(container.textContent).toContain('events here');
    expect(container.textContent).not.toContain('Records');
  });

  it('draws nothing for an id that is not a store', async () => {
    const { container } = render(<StoreBody id="svc:nope" model={await load()} />);
    expect(container.textContent).toBe('');
  });
});
