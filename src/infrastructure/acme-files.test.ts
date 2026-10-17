import { rm } from 'node:fs/promises';
import path from 'node:path';

import { afterAll, describe, expect, it, vi } from 'vitest';

import { acmeModel } from '@/../test/fixtures/acme/model';
import { pauseOrders, pauseOrdersOverlay } from '@/../test/fixtures/acme/plans/pause-orders';
import { acmeWorkspace } from '@/../test/fixtures/acme/workspace';
import { acme, acmeFiles, tempDir, writeWorkspace } from '@/../test/workspace-kit';

vi.mock(import('server-only'), () => ({}));

const { readWorkspaces } = await import('@/infrastructure/workspace-store');
const { readWorkspaceModel } = await import('@/infrastructure/workspace-model');
const { checkPlanData } = await import('@/infrastructure/plan-validator');
const { readPlan } = await import('@/infrastructure/plan-store');

const root = await tempDir('acme-files-');
afterAll(async () => rm(root, { recursive: true, force: true }));

describe('acmeFiles', () => {
  it('reads back as the Acme fixture', async () => {
    await writeWorkspace(path.join(root, 'acme'), acmeFiles());
    const [workspace] = await readWorkspaces(root);
    expect(workspace).toEqual(acmeWorkspace());
    await expect(readWorkspaceModel(acmeWorkspace(), root)).resolves.toEqual(acmeModel());
  });

  it('passes the plan schema as today', async () => {
    const check = await checkPlanData(structuredClone(acme().today.plan));
    expect(check.errors).toEqual([]);
    expect(check.warnings).toEqual([]);
  });

  it('holds a plan overlay that the store reads as planOnAcme does', async () => {
    await writeWorkspace(path.join(root, 'acme'), {
      ...acmeFiles(),
      'plans/pause-orders/plan.yaml': pauseOrdersOverlay(),
    });
    const read = await readPlan('acme', 'pause-orders', { root });
    expect(read).toMatchObject({ errors: [], warnings: [] });
    expect(read.plan).toEqual(pauseOrders());
  });
});
