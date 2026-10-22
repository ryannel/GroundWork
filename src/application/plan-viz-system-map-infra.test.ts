import { describe, expect, it } from 'vitest';

import { acmeModel } from '@/../test/fixtures/acme/model';
import { acmeWorkspace } from '@/../test/fixtures/acme/workspace';
import { drawSystemMap, SHOW_ALL } from '@/application/plan-viz-system-map';
import { infrastructureOf, withoutInfrastructure } from '@/application/plan-viz-system-map-infra';
import { systemMapInput } from '@/application/plan-viz-system-map-input';
import { systemModelOf } from '@/application/workspace-model';
import type { Workspace } from '@/domain/workspace';

/** Acme, with the card provider marked as infrastructure in its system.yaml. */
function marked(): Workspace {
  const workspace = acmeWorkspace();
  return {
    ...workspace,
    domains: workspace.domains.map((d) => ({
      ...d,
      systems: d.systems.map((s) => ({
        ...s,
        components: s.components.map((c) =>
          c.id === 'svc:card-provider' ? { ...c, infrastructure: true } : c,
        ),
      })),
    })),
  };
}

const inputOf = (workspace: Workspace) =>
  systemMapInput(systemModelOf(workspace, acmeModel()).model);

describe('infrastructure on the system map', () => {
  it('carries the mark from system.yaml to the map', () => {
    expect([...infrastructureOf(inputOf(marked()))]).toEqual(['svc:card-provider']);
    expect(infrastructureOf(inputOf(acmeWorkspace())).size).toBe(0);
  });

  it('leaves out the marked components and every line that reaches them', () => {
    const input = inputOf(marked());
    const left = withoutInfrastructure(input);
    expect(left.services.map((s) => s.id)).not.toContain('svc:card-provider');
    expect(input.edges.some((e) => e.to === 'svc:card-provider')).toBe(true);
    expect(
      left.edges.some((e) => e.to === 'svc:card-provider' || e.from === 'svc:card-provider'),
    ).toBe(false);
    const drawn = drawSystemMap(left, { show: SHOW_ALL });
    expect(drawn?.nodes.map((n) => n.id)).not.toContain('svc:card-provider');
  });

  it('gives back the same map when nothing is marked', () => {
    const input = inputOf(acmeWorkspace());
    expect(withoutInfrastructure(input)).toBe(input);
  });
});
