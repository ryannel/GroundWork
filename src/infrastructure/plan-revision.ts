import 'server-only';

import { deliveryOf } from '@/application/plan/delivery';
import { buildRevision } from '@/application/plan/revision';
import { approvedRevision, ledgerOf } from '@/application/plan/revision-ledger';
import type { VersionsData } from '@/application/plan-story-versions-data';
import type { Plan } from '@/domain/plan/plan.generated';

import { listRevisions, readRevision } from './plan-store';
import { readLoadedPlan } from './workspace-plans';

/** Every snapshot a ledger version has on disk, by version; one the schema rejects is left out. */
async function snapshots(workspace: string, slug: string): Promise<Record<string, Plan>> {
  const versions = await listRevisions(workspace, slug);
  const plans: Record<string, Plan> = {};
  await Promise.all(
    versions.map(async (version) => {
      const { plan } = await readRevision({ workspace, slug, version });
      if (plan !== null) plans[version] = plan;
    }),
  );
  return plans;
}

const cached = new Map<string, Promise<VersionsData | null>>();

async function load(workspace: string, slug: string): Promise<VersionsData | null> {
  const loaded = await readLoadedPlan(workspace, slug);
  if (loaded === null || ledgerOf(loaded.plan).length === 0) return null;
  const plans = await snapshots(workspace, slug);
  const approved = plans[approvedRevision(loaded.plan)?.version ?? ''] ?? null;
  const revision = buildRevision(loaded.plan, approved, { plans, snapshots: Object.keys(plans) });
  return { revision, delivery: deliveryOf(loaded.plan, loaded.status, approved) };
}

/** A plan's revisions and delivery, read once per build: the ledger with every snapshot on disk. Null without a ledger. */
export async function planRevision(workspace: string, slug: string): Promise<VersionsData | null> {
  const key = `${workspace}/${slug}`;
  const known = cached.get(key);
  if (known !== undefined) return known;
  const pending = load(workspace, slug);
  cached.set(key, pending);
  return pending;
}
