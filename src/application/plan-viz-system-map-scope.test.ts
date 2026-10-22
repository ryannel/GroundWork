import { describe, expect, it } from 'vitest';

import { acmeModel } from '@/../test/fixtures/acme/model';
import { acmeWorkspace } from '@/../test/fixtures/acme/workspace';
import { domainScopeOf, systemScopeOf } from '@/application/model-scope';
import { drawSystemMap, SHOW_ALL, SHOW_OVERVIEW } from '@/application/plan-viz-system-map';
import { bySystem } from '@/application/plan-viz-system-map-columns';
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

const call = (from: string, to: string) => ({
  kind: 'api' as const,
  from,
  to,
  via: null,
  steps: [],
  read: false,
  write: false,
});

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
    expect(scoped.systems.find((s) => s.id === 'sys:ordering')?.does).toBe(
      'Orders domain · Records orders and tells people about them.',
    );
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

  it('keeps a call between two neighbours in different systems, but brings in no new system', () => {
    const { input } = shared();
    const reach = call('svc:order-api', 'svc:card-provider');
    const away = call('svc:order-api', 'svc:shop-web');
    const wider = { ...input, edges: [...input.edges, reach, away] };
    const scoped = scopeMapInput(wider, { focus: ['svc:payments'], places: {} });
    expect(scoped.edges).toContain(reach);
    expect(scoped.edges).not.toContain(away);
    expect(scoped.systems.map((s) => s.id)).not.toContain('sys:shop');
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

  it('keeps the whole map, placing only the systems that say nothing of themselves, when there is no focus', () => {
    const { input } = shared();
    const quiet = { ...input, systems: input.systems.map((s) => ({ ...s, does: '' })) };
    const whole = scopeMapInput(quiet, { focus: null, places });
    expect(whole.services).toHaveLength(input.services.length);
    expect(whole.focus).toBeNull();
    expect(whole.systems.find((s) => s.id === 'sys:shop')?.does).toBe('Storefront domain');
    const said = scopeMapInput(input, { focus: null, places });
    expect(said.systems.find((s) => s.id === 'sys:shop')?.does).toBe(
      'The website the customer shops on.',
    );
    expect(drawSystemMap(whole, { show: SHOW_ALL })?.nodes.every((n) => n.lens === null)).toBe(
      true,
    );
  });

  it('reads a domain with no stages system by system, each system one card', () => {
    const { workspace, input } = shared();
    const domain = domainScopeOf(workspace, 'orders')!;
    const staged = scopeMapInput(input, { focus: [...domain.focus], places });
    expect(bySystem(staged)).toBe(false);
    const scoped = { ...staged, stages: [], stageOf: {} };
    expect(bySystem(scoped)).toBe(true);
    const drawing = drawSystemMap(scoped, { show: SHOW_ALL });
    const frames = drawing?.nodes.filter((n) => n.kind === 'system' && n.lens === 'on') ?? [];
    expect(frames.map((n) => n.id)).toEqual(
      expect.arrayContaining(['sys:ordering', 'sys:payments']),
    );
    for (const frame of frames) {
      const parts = drawing?.nodes.filter((n) => n.system === frame.id) ?? [];
      expect(parts.every((n) => n.x >= frame.x && n.x + n.w <= frame.x + frame.w)).toBe(true);
    }
    const system = systemScopeOf(workspace, 'payments')!;
    expect(bySystem(scopeMapInput(input, { focus: [...system.focus], places }))).toBe(false);
  });
});

describe('a folded system card', () => {
  it('names its team and size, and says its domain only when it sits outside the focus', () => {
    const { workspace, input } = shared();
    const scope = systemScopeOf(workspace, 'payments')!;
    const drawing = drawSystemMap(scopeMapInput(input, { focus: [...scope.focus], places }), {
      show: SHOW_OVERVIEW,
    });
    const card = (id: string) => drawing?.nodes.find((n) => n.id === id);
    expect(card('sys:payments')).toMatchObject({ folded: true, size: '2 parts' });
    expect(card('sys:payments')?.owner).not.toBe('');
    expect(card('sys:ordering')?.role.join(' ')).toMatch(/^Orders domain/u);
    expect(card('sys:payments')?.role.join(' ')).not.toMatch(/domain/u);
  });
});
