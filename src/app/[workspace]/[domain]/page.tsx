import { notFound } from 'next/navigation';

import { planCardOf } from '@/application/plan-footprint';
import { domainViewOf } from '@/application/workspace-domain';
import { workspaceNavOf } from '@/application/workspace-nav';
import { domainPaths, findWorkspace } from '@/application/workspace-paths';
import { DomainPage } from '@/features/workspace';
import { readLoadedPlans } from '@/infrastructure/workspace-plans';
import { readWorkspaces } from '@/infrastructure/workspace-store';

interface Params {
  readonly workspace: string;
  readonly domain: string;
}

export const dynamicParams = false;

export async function generateStaticParams(): Promise<Params[]> {
  return domainPaths(await readWorkspaces());
}

export default async function DomainRoute({ params }: { readonly params: Promise<Params> }) {
  const { workspace: id, domain } = await params;
  const workspace = findWorkspace(await readWorkspaces(), id);
  const view = workspace === null ? null : domainViewOf(workspace, domain);
  if (workspace === null || view === null) notFound();
  const loaded = await readLoadedPlans(workspace.id);
  const plans = loaded.map((plan) => planCardOf(workspace.id, plan));
  return <DomainPage nav={workspaceNavOf(workspace, plans, { domain })} view={view} />;
}
