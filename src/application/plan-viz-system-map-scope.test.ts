import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { domainScopeOf, systemScopeOf } from '@/application/model-scope';
import { drawSystemMap, SHOW_ALL } from '@/application/plan-viz-system-map';
import { systemMapInput } from '@/application/plan-viz-system-map-input';
import { scopeMapInput } from '@/application/plan-viz-system-map-scope';
import { systemModelOf } from '@/application/workspace-model';
import { readWorkspaceModel } from '@/infrastructure/workspace-model';
import { readWorkspaces } from '@/infrastructure/workspace-store';

vi.mock('server-only', () => ({}));

const root = path.resolve(import.meta.dirname, '../../workspaces');

async function alder() {
  const workspaces = await readWorkspaces(root);
  const workspace = workspaces.find(({ id }) => id === 'alder-finch')!;
  const { model } = systemModelOf(workspace, await readWorkspaceModel(workspace, root));
  return { workspace, input: systemMapInput(model) };
}

const places = { 'sys:checkout': 'Website domain' };

describe('a scoped system map', () => {
  it('keeps the focus and what it talks to, and leaves the rest out', async () => {
    const { workspace, input } = await alder();
    const scope = systemScopeOf(workspace, 'payments')!;
    const scoped = scopeMapInput(input, { focus: [...scope.focus], places });
    const ids = scoped.services.map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining(['svc:payments', 'svc:psp', 'svc:checkout']));
    expect(ids).not.toContain('svc:pim-admin');
    expect(scoped.systems.map((s) => s.id)).toContain('sys:checkout');
    expect(scoped.systems.find((s) => s.id === 'sys:checkout')?.does).toBe('Website domain');
    expect(scoped.services.length).toBeLessThan(input.services.length / 2);
  });

  it('follows a message through its topic, but not to others who also get it', async () => {
    const { workspace, input } = await alder();
    const scope = systemScopeOf(workspace, 'billing')!;
    const scoped = scopeMapInput(input, { focus: [...scope.focus], places: {} });
    const ids = scoped.services.map((s) => s.id);
    const producers = input.edges
      .filter((e) => e.kind === 'msg' && scope.focus.has(e.to))
      .flatMap((e) => input.edges.filter((x) => x.to === e.from && x.via === e.via))
      .map((e) => e.from);
    expect(producers.length).toBeGreaterThan(0);
    expect(ids).toEqual(expect.arrayContaining(producers));
    expect(ids).not.toContain('svc:allocation');
  });

  it('draws the focus bright and its neighbours as outside', async () => {
    const { workspace, input } = await alder();
    const scope = domainScopeOf(workspace, 'order-to-delivery')!;
    const drawing = drawSystemMap(scopeMapInput(input, { focus: [...scope.focus], places }), {
      show: SHOW_ALL,
    });
    const lens = (id: string) => drawing?.nodes.find((n) => n.id === id)?.lens;
    expect(lens('svc:payments')).toBe('on');
    expect(lens('sys:payments')).toBe('on');
    expect(lens('svc:checkout')).toBe('out');
    expect(drawing?.nodes.some((n) => n.id === 'svc:pim-admin')).toBe(false);
    const between = drawing?.lines.filter((l) => scope.focus.has(l.a) && scope.focus.has(l.b));
    expect(between?.every((l) => !l.dim)).toBe(true);
  });

  it('keeps the whole map, with each system placed, when there is no focus', async () => {
    const { input } = await alder();
    const whole = scopeMapInput(input, { focus: null, places });
    expect(whole.services).toHaveLength(input.services.length);
    expect(whole.focus).toBeNull();
    expect(whole.systems.find((s) => s.id === 'sys:checkout')?.does).toBe('Website domain');
    expect(drawSystemMap(whole, { show: SHOW_ALL })?.nodes.every((n) => n.lens === null)).toBe(
      true,
    );
  });
});
