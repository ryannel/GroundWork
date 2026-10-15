import { notFound } from 'next/navigation';

import { planCardOf } from '@/application/plan-footprint';
import { landscapeOf } from '@/application/workspace-landscape';
import { workspaceNavOf } from '@/application/workspace-nav';
import { findWorkspace } from '@/application/workspace-paths';
import { LandscapePage } from '@/features/workspace';
import { readLoadedPlans } from '@/infrastructure/workspace-plans';
import { readWorkspaces } from '@/infrastructure/workspace-store';

interface Params {
  readonly workspace: string;
}

export const dynamicParams = false;

export async function generateStaticParams(): Promise<Params[]> {
  const workspaces = await readWorkspaces();
  return workspaces.map((workspace) => ({ workspace: workspace.id }));
}

export default async function WorkspaceRoute({ params }: { readonly params: Promise<Params> }) {
  const { workspace: id } = await params;
  const workspace = findWorkspace(await readWorkspaces(), id);
  if (workspace === null) notFound();
  const loaded = await readLoadedPlans(workspace.id);
  const plans = loaded.map((plan) => planCardOf(workspace.id, plan));
  return (
    <LandscapePage
      folder={workspace.id}
      landscape={landscapeOf(workspace)}
      nav={workspaceNavOf(workspace, plans, {})}
      plans={plans}
    />
  );
}
