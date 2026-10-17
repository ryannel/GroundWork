import { describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';

import { outlineOf } from './plan-pages';
import {
  siblingsOf,
  thingByToken,
  thingHome,
  thingHref,
  thingNeighbours,
  topThingIds,
} from './plan-pages-things';

vi.mock(import('server-only'), () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');

const plan = await loadFixture('mini.yaml');
const model = derive(plan, { status: {} });
const outline = outlineOf(model, { workspace: 'shop', slug: 'mini' });

describe('thing pages', () => {
  it('gives a page to today’s things, the plan’s new ones and plan-level things, once each', () => {
    const ids = topThingIds(model);
    expect(ids).toContain('svc:subs');
    expect(ids).toContain('flow:pause');
    expect(ids).toContain('chg:pause-api');
    expect(ids).toContain('tst:pause-e2e');
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives none to the parts of a thing', () => {
    expect(topThingIds(model)).not.toContain('flow:cancel#request');
    expect(topThingIds(model)).toContain('flow:cancel');
  });

  it('puts a thing beside the others of its kind, and a part beside its parent’s parts', () => {
    expect(siblingsOf(model, 'svc:subs')).toEqual([
      'svc:web',
      'svc:subs',
      'svc:billing',
      'svc:analytics',
    ]);
    const steps = siblingsOf(model, 'flow:billing-run#charge');
    expect(steps).toContain('flow:billing-run#select-due');
    expect(steps.every((s) => s.startsWith('flow:billing-run#'))).toBe(true);
  });

  it('gives each thing an address under things/', () => {
    expect(thingHref(outline, 'flow:cancel#request')).toBe(
      '/shop/plans/mini/things/?id=flow-cancel.request',
    );
  });

  it('files a thing under its Reference catalogue, else the cover', () => {
    expect(thingHome(outline, 'svc:subs')?.href).toBe('/shop/plans/mini/ref/services/');
    expect(thingHome(outline, 'sc:trip')?.href).toBe('/shop/plans/mini/');
  });

  it('steps to the thing before and after among its siblings', () => {
    const near = thingNeighbours(model, outline, 'svc:subs');
    expect(near.previous?.title).toBe('Web app');
    expect(near.next?.href).toBe('/shop/plans/mini/things/?id=svc-billing');
    expect(thingNeighbours(model, outline, 'svc:web').previous).toBeNull();
    expect(thingNeighbours(model, outline, 'svc:analytics').next).toBeNull();
  });

  it('names each thing by a token that leads back to it', () => {
    expect(thingByToken(model, 'svc-subs')).toBe('svc:subs');
    expect(thingByToken(model, 'svc-nope')).toBeNull();
  });
});
