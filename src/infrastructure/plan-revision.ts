import 'server-only';

import { deliveryOf } from '@/application/plan/delivery';
import { buildRevision } from '@/application/plan/revision';
import { approvedRevision, ledgerOf } from '@/application/plan/revision-ledger';
import type { VersionsData } from '@/application/plan-story-versions-data';
import type { Plan } from '@/domain/plan/plan.generated';

import { listRevisions, readRevision } from './plan-store';
import { untilEdited } from './workspace-memo';
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

const remembered = untilEdited<VersionsData | null>();

async function load(workspace: string, slug: string): Promise<VersionsData | null> {
  const loaded = await readLoadedPlan(workspace, slug);
  if (loaded === null || ledgerOf(loaded.plan).length === 0) return null;
  const plans = await snapshots(workspace, slug);
  const approved = plans[approvedRevision(loaded.plan)?.version ?? ''] ?? null;
  const revision = buildRevision(loaded.plan, approved, { plans, snapshots: Object.keys(plans) });
  return { revision, delivery: deliveryOf(loaded.plan, loaded.status, approved) };
}

/** A plan's revisions and delivery, refreshed when workspace files change. Null without a ledger. */
export async function planRevision(workspace: string, slug: string): Promise<VersionsData | null> {
  return remembered(undefined, `${workspace}/${slug}`, async () => load(workspace, slug));
}
