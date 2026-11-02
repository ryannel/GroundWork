import { describe, expect, it } from 'vitest';

import type { AreaComponentView } from '@/application/workspace-area';

import { CARD, cardLayout } from './card-geometry';

const base: AreaComponentView = {
  id: 'svc:offer',
  name: 'Offer service',
  kind: 'service',
  summary: '',
  endpoints: [],
  resources: [],
  dependencies: [],
} as unknown as AreaComponentView;

describe('component card geometry', () => {
  it('puts each row centre below its section heading, in API, data, events, shared order', () => {
    const store = { ...base, id: 'st:db', kind: 'database' as const, name: 'Offer DB' };
    const topic = { ...base, id: 'tp:events', kind: 'queue' as const, name: 'Offer events' };
    const component = {
      ...base,
      endpoints: [{ id: 'api:1', signature: 'GET /v1/offers', protocol: 'http' }],
      attachments: [topic, store],
    } as unknown as AreaComponentView;
    const layout = cardLayout(component, true);
    const top = CARD.header + CARD.contents;
    expect(layout.sections.map((section) => section.kind)).toEqual(['api', 'stores', 'publishes']);
    const [api, stores, publishes] = layout.sections.map((section) => section.rows[0]?.centre);
    expect(api).toBe(top + CARD.heading + CARD.apiRow / 2);
    expect(stores).toBe(top + CARD.heading * 2 + CARD.apiRow + CARD.resourceRow / 2);
    expect(publishes).toBe(top + CARD.heading * 3 + CARD.apiRow + CARD.resourceRow * 1.5);
    expect(layout.height).toBe(
      top + CARD.heading * 3 + CARD.apiRow + CARD.resourceRow * 2 + CARD.end,
    );
    expect(layout.footer).toBe(false);

    const closed = cardLayout(component, false);
    expect(closed.open).toBe(false);
    expect(closed.sections).toEqual([]);
    expect(closed.contents).toEqual([
      { kind: 'api', count: 1 },
      { kind: 'stores', count: 1 },
      { kind: 'publishes', count: 1 },
    ]);
    expect(closed.height).toBe(top + CARD.end);
  });

  it('keeps a technology footer on a store drawn as its own card', () => {
    const layout = cardLayout({ ...base, kind: 'database' } as unknown as AreaComponentView, true);
    expect(layout.sections).toEqual([]);
    expect(layout.height).toBe(CARD.header + CARD.footer);
    expect(layout.footer).toBe(true);
  });
});
