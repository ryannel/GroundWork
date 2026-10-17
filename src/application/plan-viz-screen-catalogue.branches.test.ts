import { describe, expect, it } from 'vitest';

import { modelOf } from '@/../test/plan-kit';
import { acme } from '@/../test/workspace-kit';
import { screenCatalogue, screenCatalogueHeadline } from '@/application/plan-viz-screen-catalogue';
import type { Flow, Plan, Screen } from '@/domain/plan/plan.generated';

const today = acme().today.plan;

const screen = (id: string, service: string): Screen => ({
  id,
  name: id.slice(4),
  service,
  kind: 'page',
});

const flow = (id: string, actor: string | null, screens: readonly string[]): Flow => ({
  id,
  name: `Walk ${id.slice(5)}`,
  ...(actor === null ? {} : { actor }),
  steps: screens.map((on, k) => ({
    id: `${id}#s${String(k)}`,
    from: 'svc:shop-web',
    to: 'svc:shop-bff',
    via: 'api:bff-place-order',
    action: `Step ${String(k)}`,
    screen: on,
  })),
});

/** Today without its interactions and journeys, so screens are joined only by the order flows record. */
const recorded = (screens: readonly Screen[], flows: readonly Flow[]): Plan => ({
  ...today,
  interactions: [],
  user_journeys: [],
  screens: [...screens],
  flows: [...(today.flows ?? []), ...flows],
});

const viewOf = (plan: Plan) => {
  const view = screenCatalogue(modelOf(plan));
  if (view === null) throw new Error('no catalogue');
  return view;
};

describe('a catalogue joined by recorded order', () => {
  const plan = recorded(
    [
      screen('scr:home', 'svc:shop-web'),
      screen('scr:cart', 'svc:shop-web'),
      screen('scr:pay', 'svc:shop-web'),
      screen('scr:paid', 'svc:shop-web'),
      screen('scr:desk', 'svc:order-desk'),
      screen('scr:desk-two', 'svc:ghost'),
    ],
    [
      flow('flow:browse', null, ['scr:home', 'scr:cart']),
      flow('flow:pay', null, ['scr:pay', 'scr:paid']),
      flow('flow:desk', 'Clerk', ['scr:desk']),
      flow('flow:desk-two', 'Clerk', ['scr:desk-two']),
    ],
  );
  const view = viewOf(plan);

  it('says arrows show the recorded order, and that people can be followed', () => {
    expect(view.headline).toBe('Follow what people do and see today.');
    expect(view.key).toMatch(/^Arrows show recorded sequences\./u);
    expect(view.hasShared).toBe(false);
  });

  it('gives a journey with no actor a placeholder', () => {
    const browse = view.journeys.find((j) => j.id === 'flow:browse');
    expect(browse).toEqual({ id: 'flow:browse', name: 'Walk browse', actor: 'Actor not recorded' });
    expect(view.journeys.find((j) => j.id === 'flow:desk')?.actor).toBe('Clerk');
  });

  it('groups screens by who uses them, and notes a second unjoined sequence', () => {
    expect(view.groups.map((g) => g.label)).toEqual(['Other recorded screens', 'Clerk']);
    const other = view.groups.find((g) => g.label === 'Other recorded screens');
    expect(other?.clusters.map((c) => [c.caption, c.note])).toEqual([
      ['Walk browse', ''],
      ['Walk pay', 'Connection to the other journeys is not recorded.'],
    ]);
    const line = other?.clusters[0]?.lines[0];
    expect(line).toMatchObject({
      label: 'Next screen',
      describe: 'home to cart · Next screen',
      inspect: 'flow:browse',
      journeys: 'flow:browse',
      output: false,
      shared: false,
    });
    expect(line?.path).toMatch(/^M\d+,\d+ L/u);
  });

  it('puts screens with no link between them in one cluster, and names an app it cannot find', () => {
    const clerk = view.groups.find((g) => g.label === 'Clerk');
    expect(clerk?.clusters).toHaveLength(1);
    expect(clerk?.clusters[0]?.note).toBe('No recorded screen transition.');
    expect(clerk?.clusters[0]?.screens.map((s) => [s.id, s.meta, s.journeys])).toEqual([
      ['scr:desk', `page · ${modelOf(plan).label('svc:order-desk')}`, 'flow:desk'],
      ['scr:desk-two', 'page · Serving app not recorded', 'flow:desk-two'],
    ]);
  });

  it('lists the cards by serving app once there are more than three', () => {
    expect(view.sections.map((s) => [s.app, s.cards.map((c) => [c.id, c.meta])])).toEqual([
      [
        'Shop web',
        [
          ['scr:home', ''],
          ['scr:cart', ''],
          ['scr:pay', ''],
          ['scr:paid', ''],
        ],
      ],
      ['Order desk', [['scr:desk', '']]],
      ['Serving app not recorded', [['scr:desk-two', '']]],
    ]);
  });
});

describe('a catalogue with no journeys', () => {
  it('says the screens are not linked, and lists them as unlinked with their apps', () => {
    const plan = recorded(
      [screen('scr:home', 'svc:shop-web'), screen('scr:desk', 'svc:order-desk')],
      [],
    );
    const view = viewOf(plan);
    expect(view.headline).toBe('These screens have no recorded journey link.');
    expect(screenCatalogueHeadline(modelOf(plan))).toBe(view.headline);
    expect(view.key).toMatch(/^No transitions between screens are recorded\./u);
    expect(view.journeys).toEqual([]);
    expect(view.sections).toEqual([
      {
        app: null,
        cards: [
          { id: 'scr:home', meta: 'Shop web', unlinked: true },
          { id: 'scr:desk', meta: 'Order desk', unlinked: true },
        ],
      },
    ]);
  });
});

describe('a catalogue joined by interactions', () => {
  const screens = (today.screens ?? []).map((s) =>
    s.id === 'scr:product-page'
      ? { ...s, regions: [...(s.regions ?? []), { id: 'scr:product-page#save', name: 'Save' }] }
      : s,
  );
  const plan: Plan = {
    ...today,
    screens: [...screens, screen('scr:wishlist-email', 'svc:shop-web')],
    interactions: [
      ...(today.interactions ?? []),
      {
        id: 'ui:save',
        name: 'Save for later',
        from: ['scr:product-page#save', 'scr:basket'],
        to: 'scr:wishlist-email',
        trigger: 'click',
        effect: 'output',
      },
    ],
    user_journeys: [
      ...(today.user_journeys ?? []),
      { id: 'uj:save', name: 'Save a product', interactions: ['ui:save'] },
    ],
  };
  const view = viewOf(plan);

  it('labels arrows by their actions and draws no caption', () => {
    expect(view.key).toMatch(/^Actions label arrows\./u);
    expect(view.groups.flatMap((g) => g.clusters.map((c) => c.caption))).toEqual(
      view.groups.flatMap((g) => g.clusters.map(() => '')),
    );
    expect(view.journeys.find((j) => j.id === 'uj:save')?.actor).toBe('Actor not recorded');
  });

  it('marks a control several regions share, and a screen reached only through it', () => {
    expect(view.hasShared).toBe(true);
    const clusters = view.groups.flatMap((g) => g.clusters);
    const lines = clusters.flatMap((c) => c.lines);
    const save = lines.find((l) => l.inspect === 'ui:save');
    expect(save).toMatchObject({ output: true, shared: true, journeys: 'uj:save' });
    const boxes = clusters.flatMap((c) => c.screens);
    const shared = boxes.filter((b) => b.sharedOnly).map((b) => b.id);
    expect(shared).toEqual(['scr:wishlist-email']);
  });
});
