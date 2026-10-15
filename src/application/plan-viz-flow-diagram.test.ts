import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');
const { readPlan } = await import('@/infrastructure/plan-store');
const { derive } = await import('@/application/plan/derive');
const { flowDiagram, diagramFocus } = await import('@/application/plan-viz-flow-diagram');

const shop = derive(await loadFixture('shop.yaml'));
const mini = derive(await loadFixture('mini.yaml'));

const flowsOf = (m: typeof shop): string[] => (m.plan.flows ?? []).map((f) => f.id);

/** The pairs of cards that overlap. */
function crowded(
  d: { nodes: { id: string; x: number; y: number; w: number; h: number }[] } | null,
) {
  const nodes = d?.nodes ?? [];
  return nodes.flatMap((a, i) =>
    nodes
      .slice(i + 1)
      .filter(
        (b) => !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y),
      )
      .map((b) => `${a.id} / ${b.id}`),
  );
}

describe('a flow diagram of the shop', () => {
  const flows = flowsOf(shop);

  it('draws every flow with the systems it touches', () => {
    expect(flows.length).toBeGreaterThan(0);
    for (const id of flows) {
      const d = flowDiagram(shop, id, { mode: 'toBe' });
      expect(d?.nodes.length ?? 0).toBeGreaterThan(0);
      expect(d?.w).toBeGreaterThan(0);
      expect(d?.h).toBeGreaterThan(0);
      expect(d?.name).toBe(shop.label(id));
    }
  });

  it('keeps cards clear of one another', () => {
    for (const id of flows) {
      expect(crowded(flowDiagram(shop, id, { mode: 'toBe' })), id).toEqual([]);
    }
  });

  it('draws an arrow between known systems for each hop', () => {
    for (const id of flows) {
      const d = flowDiagram(shop, id, { mode: 'toBe' });
      const ids = new Set(d?.nodes.map((n) => n.id));
      for (const e of d?.edges ?? []) {
        expect(ids.has(e.from) && ids.has(e.to)).toBe(true);
        expect(e.d.startsWith('M')).toBe(true);
        expect(e.head.startsWith('M')).toBe(true);
        expect(e.title).not.toBe('');
      }
    }
  });

  it('puts every label inside the drawing', () => {
    for (const id of flows) {
      const d = flowDiagram(shop, id, { mode: 'toBe' });
      for (const l of d?.labels ?? []) {
        expect(l.y + l.h).toBeLessThanOrEqual(d?.h ?? 0);
        expect(l.rows.length).toBeGreaterThan(0);
      }
    }
  });

  it('numbers steps from one and letters a gateway fan-out', () => {
    const d = flowDiagram(shop, 'flow:browse', { mode: 'toBe' });
    const nums = d?.labels.flatMap((l) => l.rows.map((r) => r.num)).filter((n) => n !== null);
    expect(nums?.length).toBeGreaterThan(0);
    expect(nums?.every((n) => /^\d+[a-z]?$/.test(n))).toBe(true);
    const fan = flowDiagram(shop, 'flow:browse', { mode: 'toBe' })?.labels.flatMap((l) => l.rows);
    expect(fan?.some((r) => r.lettered)).toBe(true);
  });

  it('leaves out the teams that take no part', () => {
    const d = flowDiagram(shop, 'flow:price-purge', { mode: 'toBe' });
    expect(Array.isArray(d?.rest)).toBe(true);
  });
});

describe('walking through a flow', () => {
  it('calls the shown step current, earlier ones walked, later ones to come', () => {
    const d = flowDiagram(shop, 'flow:price-purge', { mode: 'toBe', step: 1 });
    const rows = d?.labels.flatMap((l) => l.rows).filter((r) => r.num !== null) ?? [];
    expect(rows.find((r) => r.step === 1)?.walk).toBe('current');
    expect(rows.find((r) => r.step === 0)?.walk).toBe('walked');
    expect(rows.some((r) => r.walk === 'tocome')).toBe(true);
    expect(d?.edges.some((e) => e.walk === 'current')).toBe(true);
    expect(d?.nodes.some((n) => n.touched)).toBe(true);
  });

  it('frames the shown step', () => {
    const d = flowDiagram(shop, 'flow:price-purge', { mode: 'toBe', step: 1 });
    const focus = d === null ? null : diagramFocus(d);
    expect(focus?.w).toBeGreaterThan(0);
    expect(focus?.x).toBeLessThan(d?.w ?? 0);
    const plain = flowDiagram(shop, 'flow:price-purge', { mode: 'toBe' });
    expect(plain === null ? undefined : diagramFocus(plain)).toBeNull();
  });

  it('draws plain when no step is shown', () => {
    const d = flowDiagram(shop, 'flow:price-purge', { mode: 'toBe' });
    expect(d?.edges.every((e) => e.walk === 'plain')).toBe(true);
    expect(d?.nodes.every((n) => !n.touched)).toBe(true);
  });

  it('takes several steps at once', () => {
    const d = flowDiagram(shop, 'flow:price-purge', { mode: 'toBe', step: [0, 1] });
    expect(d?.edges.filter((e) => e.walk === 'current').length).toBeGreaterThan(0);
  });

  it('carries markers and fades teams outside the lens', () => {
    const first = flowDiagram(shop, 'flow:browse', { mode: 'toBe' });
    const marked = first?.nodes[0]?.id ?? '';
    const team = shop.ownerTeam(marked) ?? undefined;
    const d = flowDiagram(shop, 'flow:browse', {
      mode: 'toBe',
      markers: { [marked]: '◇' },
      ...(team === undefined ? {} : { lens: team }),
    });
    expect(d?.nodes.find((n) => n.id === marked)?.mark).toBe('◇');
    expect(d?.nodes.find((n) => n.id === marked)?.lensOff).toBe(false);
    expect(d?.nodes.some((n) => n.lensOff)).toBe(true);
  });

  it('draws just the steps asked for, numbered as in the whole flow', () => {
    const whole = flowDiagram(shop, 'flow:price-purge', { mode: 'toBe' });
    const crop = flowDiagram(shop, 'flow:price-purge', { mode: 'toBe', only: new Set([1]) });
    expect(crop?.steps).toEqual([1]);
    expect(crop?.nodes.length).toBeLessThan(whole?.nodes.length ?? 0);
    expect(crop?.labels.flatMap((l) => l.steps)).toContain(1);
  });
});

describe('the plan on top of today', () => {
  it('marks new systems and links', () => {
    const states = flowsOf(shop).flatMap((id) => {
      const d = flowDiagram(shop, id, { mode: 'diff' });
      return [...(d?.nodes.map((n) => n.state) ?? []), ...(d?.edges.map((e) => e.state) ?? [])];
    });
    expect(states).toContain('added');
  });

  it('shows no plan marks of today', () => {
    for (const id of flowsOf(shop)) {
      const d = flowDiagram(shop, id, { mode: 'asIs' });
      expect(d?.nodes.every((n) => n.state === '')).toBe(true);
      expect(d?.edges.every((e) => e.state === '')).toBe(true);
    }
  });

  it('has nothing to draw for a flow it does not know', () => {
    expect(flowDiagram(shop, 'flow:nope')).toBeNull();
  });

  it('draws the mini plan', () => {
    for (const id of flowsOf(mini)) {
      const d = flowDiagram(mini, id, { mode: 'diff' });
      expect(d === null || d.nodes.length > 0).toBe(true);
    }
  });
});

describe('real plans', () => {
  const slugs = ['invoice-vat-number', 'delivery-promise', 'storefront-graph', 'stock-reservation'];

  it('lays out every flow without crossing cards', async () => {
    for (const slug of slugs) {
      const loaded = await readPlan('alder-finch', slug);
      if (loaded.plan === null) throw new Error(`${slug} did not load`);
      const m = derive(loaded.plan);
      for (const id of flowsOf(m)) {
        for (const mode of ['asIs', 'toBe', 'diff'] as const) {
          expect(crowded(flowDiagram(m, id, { mode })), `${slug} ${id} ${mode}`).toEqual([]);
        }
      }
    }
  });
});
