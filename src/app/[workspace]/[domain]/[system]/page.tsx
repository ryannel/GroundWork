import { notFound } from 'next/navigation';

import { partsFor, planCardOf } from '@/application/plan-footprint';
import { workspaceNavOf } from '@/application/workspace-nav';
import { findWorkspace, systemPaths } from '@/application/workspace-paths';
import { systemViewOf } from '@/application/workspace-system';
import { SystemPage } from '@/features/workspace';
import { readLoadedPlans } from '@/infrastructure/workspace-plans';
import { readWorkspaces } from '@/infrastructure/workspace-store';

interface Params {
  readonly workspace: string;
  readonly domain: string;
  readonly system: string;
}

export const dynamicParams = false;

export async function generateStaticParams(): Promise<Params[]> {
  return systemPaths(await readWorkspaces());
}

export default async function SystemRoute({ params }: { readonly params: Promise<Params> }) {
  const { workspace: id, domain, system } = await params;
  const workspace = findWorkspace(await readWorkspaces(), id);
  const view = workspace === null ? null : systemViewOf(workspace, { domain, system });
  if (workspace === null || view === null) notFound();
  const loaded = await readLoadedPlans(workspace.id);
  const parts = partsFor(workspace, { domain, system }, loaded);
  const plans = loaded.map((plan) => planCardOf(workspace.id, plan));
  return (
    <SystemPage
      nav={workspaceNavOf(workspace, plans, { domain, system })}
      parts={parts}
      view={view}
    />
  );
}
