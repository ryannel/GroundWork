import { describe, expect, it } from 'vitest';

import { acmeModel } from '@/../test/fixtures/acme/model';
import { acmeWorkspace } from '@/../test/fixtures/acme/workspace';
import { systemMapInput } from '@/application/plan-viz-system-map-input';
import { tieredMapInput } from '@/application/plan-viz-system-map-tiers';
import { systemModelOf } from '@/application/workspace-model';
import type { Workspace } from '@/domain/workspace';

/** Acme, with the shop's back end as the gateway of a graph that payments serves a subgraph of. */
function federated(workspace: Workspace = acmeWorkspace()) {
  const acme = acmeModel();
  const graphs = [{ id: 'graph:shop', name: 'Shop graph', gateway: 'svc:shop-bff' }];
  const subgraphs = [
    { id: 'sg:payments', name: 'Payments subgraph', graph: 'graph:shop', service: 'svc:payments' },
  ];
  const extra: Record<string, object> = { shop: { graphs }, payments: { subgraphs } };
  const raw = {
    ...acme,
    contracts: acme.contracts.map((c) => ({ ...c, ...extra[c.system] })),
  };
  const model = systemModelOf(workspace, raw).model;
  return { model, input: systemMapInput(model), workspace };
}

function withTier(workspace: Workspace, system: string, tier: 'channel'): Workspace {
  return {
    ...workspace,
    domains: workspace.domains.map((d) => ({
      ...d,
      systems: d.systems.map((s) => (s.id === system ? { ...s, tier } : s)),
    })),
  };
}

describe('the tiers of a domain map', () => {
  it('puts the gateway, the systems serving subgraphs and the rest in their tiers', () => {
    const { model, input, workspace } = federated();
    const { tiers } = tieredMapInput(input, model, workspace);
    expect(tiers?.['sys:shop']).toBe('gateway');
    expect(tiers?.['sys:payments']).toBe('forward');
    expect(tiers?.['sys:ordering']).toBe('backend');
  });

  it('draws the gateway asking each subgraph once, even where no flow walks it', () => {
    const { model, input, workspace } = federated();
    const { edges, labels } = tieredMapInput(input, model, workspace);
    const fanout = edges.filter((e) => e.from === 'svc:shop-bff' && e.to === 'svc:payments');
    expect(fanout).toHaveLength(1);
    expect(fanout[0]?.via).toBe('sg:payments');
    expect(labels['sg:payments']).toBeDefined();
  });

  it('lets a person put a system in another tier', () => {
    const { model, input, workspace } = federated(withTier(acmeWorkspace(), 'ordering', 'channel'));
    const { tiers } = tieredMapInput(input, model, workspace);
    expect(tiers?.['sys:ordering']).toBe('channel');
  });
});
