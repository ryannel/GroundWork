import { describe, expect, it } from 'vitest';

import { acmeModel } from '@/../test/fixtures/acme/model';
import { acmeWorkspace } from '@/../test/fixtures/acme/workspace';
import { domainScopeOf, systemScopeOf } from '@/application/model-scope';
import { drawSystemMap, SHOW_ALL } from '@/application/plan-viz-system-map';
import { systemMapInput } from '@/application/plan-viz-system-map-input';
import { scopeMapInput } from '@/application/plan-viz-system-map-scope';
import { systemModelOf } from '@/application/workspace-model';

/** Acme, with the shop's order service also listening for product changes. */
function shared() {
  const workspace = acmeWorkspace();
  const model = acmeModel();
  const message = model.contracts
    .flatMap((c) => c.messages)
    .find((m) => m.id === 'msg:product-changed');
  if (message === undefined) throw new Error('no product.changed');
  message.consumers = [...(message.consumers ?? []), 'svc:order-api'];
  const today = systemModelOf(workspace, model).model;
  return { workspace, input: systemMapInput(today) };
}

const places = { 'sys:ordering': 'Orders domain', 'sys:shop': 'Storefront domain' };

describe('a scoped system map', () => {
  it('keeps the focus and what it talks to, and leaves the rest out', () => {
    const { workspace, input } = shared();
    const scope = systemScopeOf(workspace, 'payments')!;
    const scoped = scopeMapInput(input, { focus: [...scope.focus], places });
    const ids = scoped.services.map((s) => s.id);
    expect(ids.toSorted((a, b) => a.localeCompare(b))).toEqual([
      'svc:card-provider',
      'svc:order-api',
      'svc:payments',
    ]);
    expect(scoped.systems.map((s) => s.id)).toContain('sys:ordering');
    expect(scoped.systems.find((s) => s.id === 'sys:ordering')?.does).toBe('Orders domain');
    expect(scoped.systems.map((s) => s.id)).not.toContain('sys:shop');
    expect(scoped.services.length).toBeLessThan(input.services.length / 2);
  });

  it('follows a message through its topic, but not to others who also get it', () => {
    const { workspace, input } = shared();
    const scope = systemScopeOf(workspace, 'search')!;
    const scoped = scopeMapInput(input, { focus: [...scope.focus], places: {} });
    const ids = scoped.services.map((s) => s.id);
    const producers = input.edges
      .filter((e) => e.kind === 'msg' && scope.focus.has(e.to))
      .flatMap((e) => input.edges.filter((x) => x.to === e.from && x.via === e.via))
      .map((e) => e.from);
    expect(producers).toEqual(['svc:products']);
    expect(ids).toEqual(expect.arrayContaining(producers));
    expect(
      input.edges.some(
        (e) => e.kind === 'msg' && e.to === 'svc:order-api' && e.via === 'msg:product-changed',
      ),
    ).toBe(true);
    expect(ids).not.toContain('svc:order-api');
  });

  it('draws the focus bright and its neighbours as outside', () => {
    const { workspace, input } = shared();
    const scope = domainScopeOf(workspace, 'orders')!;
    const drawing = drawSystemMap(scopeMapInput(input, { focus: [...scope.focus], places }), {
      show: SHOW_ALL,
    });
    const lens = (id: string) => drawing?.nodes.find((n) => n.id === id)?.lens;
    expect(lens('svc:payments')).toBe('on');
    expect(lens('sys:payments')).toBe('on');
    expect(lens('svc:order-api')).toBe('on');
    expect(lens('svc:shop-bff')).toBe('out');
    expect(drawing?.nodes.some((n) => n.id === 'svc:product-admin')).toBe(false);
    const between = drawing?.lines.filter((l) => scope.focus.has(l.a) && scope.focus.has(l.b));
    expect(between?.length).toBeGreaterThan(0);
    expect(between?.every((l) => !l.dim)).toBe(true);
  });

  it('keeps the whole map, with each system placed, when there is no focus', () => {
    const { input } = shared();
    const whole = scopeMapInput(input, { focus: null, places });
    expect(whole.services).toHaveLength(input.services.length);
    expect(whole.focus).toBeNull();
    expect(whole.systems.find((s) => s.id === 'sys:shop')?.does).toBe('Storefront domain');
    expect(drawSystemMap(whole, { show: SHOW_ALL })?.nodes.every((n) => n.lens === null)).toBe(
      true,
    );
  });
});
