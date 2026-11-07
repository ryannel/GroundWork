// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { contractsPlans, stagedDeliveryTime } from '@/../test/fixtures/acme/plans/contracts-plans';
import { modelOf } from '@/../test/plan-kit';
import { SHOW_ALL, SHOW_OVERVIEW, drawSystemMap } from '@/application/plan-viz-system-map';
import { layoutColumns } from '@/application/plan-viz-system-map-columns';
import { systemMapInput } from '@/application/plan-viz-system-map-input';
import type { Aggregate, Link } from '@/application/plan-viz-system-map-links';
import { traceOf } from '@/application/plan-viz-system-map-trace';
import type { MapServiceIn, SystemMapInput } from '@/application/plan-viz-system-map-types';

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
    expect({ open, folded }).toMatchSnapshot('format 1 staged map keeps both arrangements');
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

function placementFixture(): { input: SystemMapInput; aggregate: Aggregate } {
  const services = ['caller', 'supplier', 'reader', 'archive'].map((name): MapServiceIn => ({
    id: `svc:${name}`,
    name,
    system: null,
    kind: 'service',
    does: '',
    team: null,
    teamSlot: 8,
  }));
  const connections: readonly (readonly [Link['kind'], string, string])[] = [
    ['api', 'svc:caller', 'svc:supplier'],
    ['msg', 'svc:supplier', 'svc:reader'],
    ['data', 'svc:reader', 'st:archive'],
  ];
  const input: SystemMapInput = {
    services,
    systems: [],
    stores: [],
    edges: [],
    steps: [],
    stages: [],
    stageOf: {},
    refs: {},
    interfaceOf: {},
    labels: {},
    lens: null,
    focus: null,
  };
  return {
    input,
    aggregate: {
      links: connections.map(([kind, a, b]): Link => ({
        key: `${kind}|${a}|${b}`,
        kind,
        a,
        b,
        row: null,
        vias: new Set(),
        flows: new Set(),
        flags: new Set(),
      })),
      rowsOf: new Map(),
      kinds: new Map(),
      hostOfSat: new Map([['st:archive', 'svc:archive']]),
      isTopic: () => false,
    },
  };
}

it('lays out the chain of calls and messages without using data access as a stage', () => {
  const { input, aggregate } = placementFixture();
  const columns = layoutColumns(input, aggregate);
  expect(columns.used).toEqual([0, 1, 2]);
  expect(columns.colOfU('svc:caller')).toBe(0);
  expect(columns.colOfU('svc:supplier')).toBe(1);
  expect(columns.colOfU('svc:reader')).toBe(2);
  expect(columns.colOfU('svc:archive')).toBe(0);
  expect(columns.unitOf('st:archive')).toBe('svc:archive');
  expect(columns.cols.map((col) => col.toSorted((a, b) => a.localeCompare(b)))).toEqual([
    ['svc:archive', 'svc:caller'],
    ['svc:supplier'],
    ['svc:reader'],
  ]);
});

it('places the API provider and event publisher above their users when they share a stage', () => {
  const { input, aggregate } = placementFixture();
  const columns = layoutColumns(
    {
      ...input,
      stages: [{ id: 'stage:one', name: 'One', summary: '', entries: [] }],
      stageOf: { 'svc:caller': 0, 'svc:supplier': 0, 'svc:reader': 0 },
    },
    aggregate,
  );
  expect(columns.cols).toHaveLength(1);
  const list = columns.cols[0] ?? [];
  expect(list).toHaveLength(4);
  expect(list.indexOf('svc:supplier')).toBeLessThan(list.indexOf('svc:caller'));
  expect(list.indexOf('svc:supplier')).toBeLessThan(list.indexOf('svc:reader'));
  expect(columns.colOfU('svc:archive')).toBe(0);
});
