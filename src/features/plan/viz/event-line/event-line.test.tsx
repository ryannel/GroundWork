// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';
import { EventLine, EventLines } from '@/features/plan/viz/event-line/event-line';

vi.mock('server-only', () => ({}));

afterEach(cleanup);

async function load() {
  const { readPlan } = await import('@/infrastructure/plan-store');
  const loaded = await readPlan('alder-finch', 'delivery-promise');
  return derive(loaded.plan!);
}

describe('event line', () => {
  it('draws the flow and opens to the payload, the points and the migration', async () => {
    const model = await load();
    const { container } = render(
      <EventLine
        id="msg:product-published"
        ladderHref="/ladder"
        mode="diff"
        model={model}
        stepHref={(s) => `/step/${s}`}
      />,
    );
    const details = container.querySelector('details');
    expect(details?.dataset.search).toContain('product.published');
    expect(
      container.querySelector('button[data-inspect="msg:product-published"]')?.textContent,
    ).toContain('v1');
    expect(container.textContent).toContain('goes to v2');
    expect(container.querySelector('a[href="/ladder"]')?.textContent).toBe('See the ladder');
    expect(container.textContent).toContain('Open event →');
  });

  it('draws a bare line without its body, or without its facts', async () => {
    const model = await load();
    const bare = render(<EventLine bare id="msg:product-published" model={model} />);
    expect(bare.container.querySelector('details')).toBeNull();
    expect(bare.container.textContent).toContain('key');
    const flow = render(<EventLine bare="flow" id="msg:product-published" model={model} />);
    expect(flow.container.textContent).not.toContain('key');
  });

  it('keeps the subject quiet and leaves out the topic of a group', async () => {
    const model = await load();
    const { container } = render(
      <EventLine groupTopic id="msg:product-published" mode="asIs" model={model} self="svc:pim" />,
    );
    expect(container.querySelector('[data-quiet]')).not.toBeNull();
    expect(container.querySelector('[data-inspect^="top:"]')).toBeNull();
  });

  it('lists events in catalogue order and skips ids that are no event', async () => {
    const model = await load();
    const ids = model.toBe.messages.map((m) => m.id);
    const { container } = render(<EventLines ids={[...ids, 'sch:shipment']} model={model} />);
    expect(container.querySelectorAll('details')).toHaveLength(ids.length);
  });

  it('says a removed event is removed', async () => {
    const model = await load();
    const gone = model.asIs.messages.find((m) => !model.toBe.has(m.id));
    if (gone === undefined) return;
    const { container } = render(<EventLine id={gone.id} model={model} />);
    expect(container.textContent).toContain('Removed');
  });
});
