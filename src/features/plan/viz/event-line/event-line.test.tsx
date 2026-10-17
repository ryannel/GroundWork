// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { dispatchDate } from '@/../test/fixtures/acme/plans/work-dispatch';
import { modelOf } from '@/../test/plan-kit';
import { EventLine, EventLines } from '@/features/plan/viz/event-line/event-line';

afterEach(cleanup);

const load = () => modelOf(dispatchDate());

describe('event line', () => {
  it('draws the flow and opens to the payload, the points and the migration', () => {
    const model = load();
    const { container } = render(
      <EventLine
        id="msg:product-changed"
        ladderHref="/ladder"
        mode="diff"
        model={model}
        stepHref={(s) => `/step/${s}`}
      />,
    );
    const details = container.querySelector('details');
    expect(details?.dataset.search).toContain('product.changed');
    expect(
      container.querySelector('button[data-inspect="msg:product-changed"]')?.textContent,
    ).toContain('v1');
    expect(container.textContent).toContain('goes to v2');
    expect(container.querySelector('a[href="/ladder"]')?.textContent).toBe('See the ladder');
    expect(container.textContent).toContain('Open event →');
  });

  it('draws a bare line without its body, or without its facts', () => {
    const model = load();
    const bare = render(<EventLine bare id="msg:product-changed" model={model} />);
    expect(bare.container.querySelector('details')).toBeNull();
    expect(bare.container.textContent).toContain('key');
    const flow = render(<EventLine bare="flow" id="msg:product-changed" model={model} />);
    expect(flow.container.textContent).not.toContain('key');
  });

  it('keeps the subject quiet and leaves out the topic of a group', () => {
    const model = load();
    const { container } = render(
      <EventLine
        groupTopic
        id="msg:product-changed"
        mode="asIs"
        model={model}
        self="svc:products"
      />,
    );
    expect(container.querySelector('[data-quiet]')).not.toBeNull();
    expect(container.querySelector('[data-inspect^="top:"]')).toBeNull();
  });

  it('lists events in catalogue order and skips ids that are no event', () => {
    const model = load();
    const ids = model.toBe.messages.map((m) => m.id);
    const { container } = render(<EventLines ids={[...ids, 'sch:search-doc']} model={model} />);
    expect(ids).toEqual(['msg:order-placed', 'msg:product-changed-v2']);
    expect(container.querySelectorAll('details')).toHaveLength(2);
  });

  it('says a removed event is removed', () => {
    const model = load();
    expect(model.asIs.messages.filter((m) => !model.toBe.has(m.id)).map((m) => m.id)).toEqual([
      'msg:product-changed',
    ]);
    const { container } = render(<EventLine id="msg:product-changed" model={model} />);
    expect(container.textContent).toContain('Removed');
    expect(
      container.querySelector<HTMLElement>('button[data-inspect="msg:product-changed"]')?.dataset
        .status,
    ).toBe('removed');
  });
});
