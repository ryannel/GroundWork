import { rm } from 'node:fs/promises';
import path from 'node:path';

import { afterAll, describe, expect, it, vi } from 'vitest';

import { byId, shop } from '@/../test/federation-kit';
import { pauseOrdersOverlay } from '@/../test/fixtures/acme/plans/pause-orders';
import { productGraphOverlay } from '@/../test/fixtures/acme/plans/store-plans';
import { acmeFiles, tempDir, writeWorkspace } from '@/../test/workspace-kit';
import type { Plan } from '@/domain/plan/plan.generated';

vi.mock(import('server-only'), () => ({}));

const { checkPlanData } = await import('./plan-validator');
const { listPlans, readPlan } = await import('./plan-store');

const root = await tempDir('plan-validator-federation-');
afterAll(async () => rm(root, { recursive: true, force: true }));
await writeWorkspace(path.join(root, 'acme'), {
  ...acmeFiles(),
  'plans/pause-orders/plan.yaml': pauseOrdersOverlay(),
  'plans/product-graph/plan.yaml': productGraphOverlay(),
});

async function errorsOf(mutate: (p: Plan) => void): Promise<string[]> {
  const p = shop();
  mutate(p);
  const { errors } = await checkPlanData(p);
  return errors.map((e) => `${e.path}: ${e.message}`);
}

describe('graph-type shape (schema)', () => {
  it('the shop passes the schema and the checks', async () => {
    const r = await checkPlanData(shop());
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it('every workspace plan, the graph plan included, validates with no findings', async () => {
    const slugs = await listPlans('acme', root);
    expect(slugs).toEqual(['pause-orders', 'product-graph']);
    for (const slug of slugs) {
      const r = await readPlan('acme', slug, { root });
      expect([slug, r.errors, r.warnings]).toEqual([slug, [], []]);
    }
    const { plan } = await readPlan('acme', 'product-graph', { root });
    const added = plan?.changes?.flatMap(({ ops }) =>
      ops.map((op) => ('add' in op ? op.add : null)),
    );
    expect(added).toEqual(['graph', 'subgraph', 'schema', 'schema', 'operation']);
  });

  it('a graph type must name its graph', async () => {
    const errors = await errorsOf((p) => {
      delete byId(p.schemas, 'sch:gql-money').graph;
    });
    expect(errors.some((e) => /schemas\[\d+\]\.graph: is required/u.test(e))).toBe(true);
  });

  it('graph-only props stay on graph types', async () => {
    const onField = await errorsOf((p) => {
      byId(p.schemas, 'sch:price').fields![0]!.subgraphs = ['sg:pricing'];
    });
    expect(
      onField.some((e) =>
        e.includes('schemas[1].fields[0].subgraphs: subgraphs belongs to a GraphQL type'),
      ),
    ).toBe(true);
    const onType = await errorsOf((p) => {
      byId(p.schemas, 'sch:price').graph = 'graph:shop';
    });
    expect(onType.some((e) => e.includes('graph belongs to a GraphQL type'))).toBe(true);
  });
});
