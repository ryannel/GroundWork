// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { contractsPlans, stagedDeliveryTime } from '@/../test/fixtures/acme/plans/contracts-plans';
import { modelOf } from '@/../test/plan-kit';
import { SHOW_ALL, SHOW_OVERVIEW, drawSystemMap } from '@/application/plan-viz-system-map';
import { systemMapInput } from '@/application/plan-viz-system-map-input';
import { traceOf } from '@/application/plan-viz-system-map-trace';

const PLANS = [...contractsPlans(), ['staged delivery-time', stagedDeliveryTime()] as const];
const load = () => modelOf(stagedDeliveryTime());

describe('system map layout', () => {
  it.each(PLANS)('draws every system of %s inside its drawing, in both layouts', (_, plan) => {
    const model = modelOf(plan);
    const input = systemMapInput(model);
    for (const show of [SHOW_ALL, SHOW_OVERVIEW]) {
      const drawing = drawSystemMap(input, { show });
      if (drawing === null) throw new Error('nothing drawn');
      expect(drawing.services).toBe(model.asIs.services.length);
      const ids = drawing.nodes.map((n) => n.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const n of drawing.nodes) {
        expect(n.x).toBeGreaterThanOrEqual(0);
        expect(n.x + n.w).toBeLessThanOrEqual(drawing.w);
        expect(n.y + n.h).toBeLessThanOrEqual(drawing.h);
      }
      for (const l of drawing.lines) expect(l.d.startsWith('M')).toBe(true);
    }
  });

  it.each(PLANS)('hides topics, stores and interfaces in the overview of %s', (_, plan) => {
    const input = systemMapInput(modelOf(plan));
    const full = drawSystemMap(input, { show: SHOW_ALL });
    const small = drawSystemMap(input, { show: SHOW_OVERVIEW });
    expect(small?.nodes.some((n) => n.kind === 'topic' || n.kind === 'store')).toBe(false);
    expect(small?.nodes.some((n) => n.part)).toBe(false);
    expect((full?.nodes.length ?? 0) >= (small?.nodes.length ?? 0)).toBe(true);
  });

  it('folds one system when asked', () => {
    const input = systemMapInput(load());
    const open = drawSystemMap(input, { show: SHOW_ALL });
    const system = open?.nodes.find((n) => n.kind === 'system');
    if (system === undefined) throw new Error('no system');
    const folded = drawSystemMap(input, { show: SHOW_ALL, flip: new Set([system.id]) });
    expect(open?.nodes.filter((n) => n.system === system.id).length).toBeGreaterThan(0);
    expect(folded?.nodes.filter((n) => n.system === system.id).length).toBe(0);
    expect(folded?.nodes.find((n) => n.id === system.id)?.folded).toBe(true);
    const inside = open?.nodes.filter((n) => n.system === system.id && n.part).length;
    expect(inside).toBeGreaterThan(0);
    expect(system.partCount).toBe(inside);
    expect(folded?.nodes.find((n) => n.id === system.id)?.partCount).toBe(inside);
  });

  it('dims everything outside a team lens', () => {
    const model = load();
    const team =
      model.asIs.services.map((s) => model.ownerTeam(s.id)).find((t) => t !== null) ?? null;
    const drawing = drawSystemMap(systemMapInput(model, team), { show: SHOW_ALL });
    const states = new Set(drawing?.nodes.map((n) => n.lens));
    expect(states.has('on')).toBe(true);
  });
});

describe('system map trace', () => {
  it.each(PLANS)('lights a card with its lines and neighbours in %s', (_, plan) => {
    const drawing = drawSystemMap(systemMapInput(modelOf(plan)), { show: SHOW_ALL });
    const line = drawing?.lines[0];
    if (drawing === null || line === undefined) throw new Error('nothing drawn');
    const card = traceOf(drawing, { kind: 'node', id: line.a });
    expect(card.lines.has(line.key)).toBe(true);
    expect(card.nodes.has(line.b)).toBe(true);
    const one = traceOf(drawing, { kind: 'line', key: line.key });
    expect([...one.lines]).toEqual([line.key]);
    expect(one.nodes.has(line.a)).toBe(true);
    expect(one.nodes.has(line.b)).toBe(true);
  });

  it('lights the parts of a system and their partners', () => {
    const drawing = drawSystemMap(systemMapInput(load()), {
      show: SHOW_ALL,
    });
    const system = drawing?.nodes.find((n) => n.kind === 'system');
    if (drawing === null || system === undefined) throw new Error('no system');
    const lit = traceOf(drawing, { kind: 'node', id: system.id });
    const parts = drawing.nodes.filter((n) => n.system === system.id);
    expect(parts.every((p) => lit.nodes.has(p.id))).toBe(true);
  });
});
