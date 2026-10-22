import { describe, expect, it } from 'vitest';

import { acmeModel } from '@/../test/fixtures/acme/model';
import { acmeWorkspace } from '@/../test/fixtures/acme/workspace';
import { drawSystemMap, SHOW_OVERVIEW } from '@/application/plan-viz-system-map';
import { systemMapInput } from '@/application/plan-viz-system-map-input';
import { sharedOutside } from '@/application/plan-viz-system-map-part-tiers';
import { tieredMapInput } from '@/application/plan-viz-system-map-tiers';
import type { MapEdgeIn, SystemMapInput } from '@/application/plan-viz-system-map-types';
import { systemModelOf } from '@/application/workspace-model';

/** Acme read system by system, in tiers, with any extra edges. */
function tiered(extra: readonly MapEdgeIn[] = []): SystemMapInput {
  const workspace = acmeWorkspace();
  const model = systemModelOf(workspace, acmeModel()).model;
  const input = tieredMapInput(systemMapInput(model), model, workspace);
  return {
    ...input,
    edges: [...input.edges, ...extra],
    stages: [],
    stageOf: {},
    refs: {},
    focus: input.systems.map((s) => s.id),
  };
}

const edge = (kind: MapEdgeIn['kind'], from: string, to: string, via: string): MapEdgeIn => ({
  kind,
  from,
  to,
  via,
  steps: [],
  read: false,
  write: false,
});

describe('a system map read system by system', () => {
  it('keeps an outside party inside the one system that talks to it', () => {
    const drawn = drawSystemMap(tiered(), { show: SHOW_OVERVIEW });
    expect(sharedOutside(tiered()).size).toBe(0);
    expect(drawn?.nodes.map((n) => n.id)).not.toContain('svc:card-provider');
  });

  it('gives an outside party its own card once a second system talks to it', () => {
    const input = tiered([edge('api', 'svc:order-api', 'svc:card-provider', 'api:card-charge')]);
    expect([...sharedOutside(input)]).toEqual(['svc:card-provider']);
    const drawn = drawSystemMap(input, { show: SHOW_OVERVIEW });
    expect(drawn?.nodes.map((n) => n.id)).toContain('svc:card-provider');
  });

  it('draws one line for a pair of systems, from the one that needs the data', () => {
    const input = tiered([edge('msg', 'svc:order-api', 'svc:shop-bff', 'msg:order-placed')]);
    const lines = drawSystemMap(input, { show: SHOW_OVERVIEW })?.lines ?? [];
    const pair = lines.filter(
      (l) =>
        [l.a, l.b].toSorted((x, y) => x.localeCompare(y)).join('|') === 'sys:ordering|sys:shop',
    );
    expect(pair).toHaveLength(1);
    expect(pair[0]?.a).toBe('sys:shop');
    expect(pair[0]?.kinds.toSorted()).toEqual(['api', 'msg']);
  });

  it('says what a line carries by name, and turns an event round to its listener', () => {
    const lines = drawSystemMap(tiered(), { show: SHOW_OVERVIEW })?.lines ?? [];
    const shop = lines.find((l) => l.a === 'sys:shop');
    expect(shop?.tag).toBe('Order');
    expect(shop?.tip).toMatch(/^Shop gets data from Ordering/u);
    const search = lines.find((l) => l.a === 'sys:search');
    expect(search?.b).toBe('sys:products');
    expect(search?.tip).toMatch(/^Search listens to Products/u);
  });
});
