import { describe, expect, it } from 'vitest';

import { accountPlan } from '@/../test/screens-kit';
import { derive } from '@/application/plan/derive';
import {
  assetUrl,
  figureOf,
  isNarrow,
  percent,
  regionChange,
  regionCount,
  regionNumbers,
  regionsOf,
  sameShape,
  screenIn,
  screenKind,
  screenLinks,
  stopScreens,
  stripLegs,
} from '@/application/plan-viz-screens';

const model = derive(accountPlan());
const base = '/acme/plans/pause/';

describe('screen words and addresses', () => {
  it('names the kind of screen', () => {
    expect(screenKind({ kind: 'push' })).toBe('push notification');
    expect(screenKind({})).toBe('page');
  });

  it('finds a screen on either side and not a thing that is no screen', () => {
    expect(screenIn(model, 'scr:account')?.name).toBe('Account');
    expect(screenIn(model, 'scr:account', 'asIs')?.image).toBe('assets/account.svg');
    expect(screenIn(model, 'scr:account', 'toBe')?.image).toBe('assets/account-tobe.svg');
    expect(screenIn(model, 'svc:web')).toBeUndefined();
    expect(screenIn(model, 'scr:nope', 'toBe')).toBeUndefined();
  });

  it('puts a picture under the plan’s address', () => {
    expect(assetUrl(base, 'assets/a.png')).toBe('/acme/plans/pause/assets/a.png');
    expect(assetUrl(base, './assets/a.png')).toBe('/acme/plans/pause/assets/a.png');
    expect(assetUrl(base, null)).toBe('');
    expect(assetUrl(base, 'https://cdn.example/a.png')).toBe('https://cdn.example/a.png');
  });

  it('keeps percentages inside the picture', () => {
    expect([percent(-4), percent(130), percent('x'), percent(42)]).toEqual([0, 100, 0, 42]);
  });

  it('knows a narrow screen from a wide one', () => {
    expect(isNarrow({ device: 'mobile' })).toBe(true);
    expect(isNarrow({ device: 'desktop' })).toBe(false);
    expect(isNarrow(screenIn(model, 'svc:web'))).toBe(false);
  });
});

describe('regions in list order', () => {
  it('lists the regions as the plan leaves them, then the ones it removes', () => {
    const rows = regionsOf(model, 'scr:account', { mode: 'toBe', status: true });
    expect(rows.map((r) => `${r.id}:${r.status}${r.gone ? ':gone' : ''}`)).toEqual([
      'scr:account#plan:modified',
      'scr:account#pause:added',
      'scr:account#cancel:removed:gone',
    ]);
    expect([...regionNumbers(rows).values()]).toEqual([1, 2, 3]);
  });

  it('lists today’s regions untouched', () => {
    const rows = regionsOf(model, 'scr:account', { mode: 'asIs' });
    expect(rows.map((r) => r.id)).toEqual(['scr:account#plan', 'scr:account#cancel']);
    expect(rows.every((r) => r.status === 'existing' && !r.gone)).toBe(true);
    expect(rows[0]?.shows).toBe('Status and renewal date.');
  });

  it('is empty for a thing that is no screen', () => {
    expect(regionsOf(model, 'svc:web')).toEqual([]);
  });
});

describe('the picture', () => {
  it('draws regions with their status, number and ghosts', () => {
    const rows = regionsOf(model, 'scr:account', { mode: 'toBe', status: true });
    const fig = figureOf(model, 'scr:account', {
      mode: 'toBe',
      base,
      status: true,
      numbers: regionNumbers(rows),
      ghosts: rows.filter((r) => r.gone),
      focus: ['scr:account#pause'],
    });
    expect(fig?.image).toBe('/acme/plans/pause/assets/account-tobe.svg');
    expect(fig?.route).toBe('/account');
    expect(fig?.kind).toBe('page');
    expect(fig?.device).toBe('desktop');
    expect(fig?.regions.map((r) => [r.id, r.status, r.number, r.lit, r.note])).toEqual([
      ['scr:account#plan', 'modified', 1, false, 'changes'],
      ['scr:account#pause', 'added', 2, true, 'new'],
    ]);
    expect(fig?.ghosts).toEqual([
      { id: 'scr:account#cancel', name: 'Cancel', at: { x: 10, y: 50, w: 80, h: 10 }, number: 3 },
    ]);
  });

  it('draws today’s regions outlined as removed when asked to', () => {
    const fig = figureOf(model, 'scr:account', {
      mode: 'asIs',
      base,
      removed: ['scr:account#cancel'],
    });
    expect(fig?.image).toBe('/acme/plans/pause/assets/account.svg');
    expect(fig?.regions.map((r) => [r.id, r.status])).toEqual([
      ['scr:account#plan', 'existing'],
      ['scr:account#cancel', 'removed'],
    ]);
    expect(fig?.regions[1]?.note).toBe('removed');
  });

  it('has no picture for a screen the plan lacks', () => {
    expect(figureOf(model, 'scr:nope', { base })).toBeNull();
  });
});

describe('the strip of screens', () => {
  const legs = [
    { screen: 'scr:account', stepIds: ['a', 'b'] },
    { screen: 'scr:gone', stepIds: ['c'] },
  ];

  it('says which leg is current and which stop reaches it', () => {
    const out = stripLegs(model, legs, {
      base,
      currentStepIds: ['b'],
      stops: [
        { stepIds: ['x'], indices: [0] },
        { stepIds: ['a'], indices: [1] },
      ],
    });
    expect(out.map((l) => [l.screen, l.current, l.stop])).toEqual([
      ['scr:account', true, 1],
      ['scr:gone', false, -1],
    ]);
    expect(out[0]?.image).toBe('/acme/plans/pause/assets/account-tobe.svg');
    expect(out[0]?.status).toBe('modified');
    expect(out[1]).toMatchObject({ name: 'scr:gone', image: '', status: 'existing' });
  });

  it('shows today’s picture, unmarked, for the as-is journey', () => {
    const [leg] = stripLegs(model, legs, { base, mode: 'asIs' });
    expect(leg?.image).toBe('/acme/plans/pause/assets/account.svg');
    expect(leg?.status).toBe('existing');
    expect(leg?.stop).toBe(-1);
  });

  it('lists the screens a stop reaches, once each in order, with the regions touched', () => {
    const steps = [
      { screen: 'scr:account' },
      { screen: 'scr:account#plan' },
      { screen: 'scr:account#plan' },
      { screen: null },
      { screen: 'scr:other#x' },
      { screen: 'scr:account' },
    ];
    expect(stopScreens(steps, { indices: [0, 1, 2, 3, 4, 5, 9] })).toEqual([
      { screen: 'scr:account', regions: ['scr:account#plan'] },
      { screen: 'scr:other', regions: ['scr:other#x'] },
      { screen: 'scr:account', regions: [] },
    ]);
    expect(stopScreens(steps, { indices: [] })).toEqual([]);
  });
});

describe('links and changes', () => {
  it('offers the plan’s walking mockup to a touched screen that has none', () => {
    const plan = accountPlan();
    plan.screens?.push({
      id: 'scr:other',
      name: 'Other',
      service: 'svc:web',
      mockup: 'mockups/walk.html',
      figma: 'https://figma.example/x',
    });
    const m = derive(plan);
    expect(screenLinks(m, 'scr:account', { base })).toEqual({
      figma: null,
      mockup: '/acme/plans/pause/mockups/walk.html#scr:account',
    });
    expect(screenLinks(m, 'scr:account', { base, mode: 'asIs' }).mockup).toBeNull();
    expect(screenLinks(m, 'scr:other', { base })).toEqual({
      figma: 'https://figma.example/x',
      mockup: '/acme/plans/pause/mockups/walk.html#scr:other',
    });
  });

  it('says what the plan does to a region in words', () => {
    const change = regionChange(model, 'scr:account#plan');
    expect(change.shows).toEqual({
      before: 'Status and renewal date.',
      after: 'Status, renewal date and a pause badge.',
    });
    expect(change.lines).toEqual([]);
    expect(regionChange(model, 'scr:account#pause')).toEqual({ shows: null, lines: [] });
  });
});

describe('before | after helpers', () => {
  it('lets two pictures swipe only when they are the same shape', () => {
    expect(sameShape({ width: 800, height: 600 }, { width: 820, height: 610 })).toBe(true);
    expect(sameShape({ width: 800, height: 600 }, { width: 400, height: 800 })).toBe(false);
    expect(sameShape({ width: 0, height: 0 }, { width: 400, height: 800 })).toBe(false);
  });

  it('counts regions in words', () => {
    expect([0, 1, 3].map(regionCount)).toEqual(['no regions named', '1 region', '3 regions']);
  });
});
