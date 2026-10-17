import { notFound } from 'next/navigation';

import { planRowsOf } from '@/application/plan-index';
import { workspaceNavOf } from '@/application/workspace-nav';
import { workspaceHref } from '@/application/workspace-paths';
import { TodayOverlays, TodaySearch } from '@/features/plan';
import { PlansPage, WorkspaceShell } from '@/features/workspace';
import { todayData } from '@/infrastructure/today-data';
import { readLoadedPlans } from '@/infrastructure/workspace-plans';
import { readWorkspaces } from '@/infrastructure/workspace-store';

interface Params {
  readonly workspace: string;
}

export const dynamicParams = false;

export async function generateStaticParams(): Promise<Params[]> {
  const workspaces = await readWorkspaces();
  return workspaces.map(({ id }) => ({ workspace: id }));
}

export default async function PlansRoute({ params }: { readonly params: Promise<Params> }) {
  const { workspace: id } = await params;
  const data = await todayData(id);
  if (data === null) notFound();
  const { workspace, today, plans } = data;
  const rows = planRowsOf(workspace, await readLoadedPlans(workspace.id));
  return (
    <WorkspaceShell
      actions={<TodaySearch />}
      nav={workspaceNavOf(workspace, plans, { section: 'plans', today: today.model })}
      overlays={<TodayOverlays depth={1} workspace={workspace} />}
      title="Plans"
      trail={[
        { label: 'Workspaces', href: '/' },
        { label: workspace.name, href: workspaceHref(workspace.id) },
      ]}
    >
      <PlansPage domains={workspace.domains.map((d) => ({ id: d.id, name: d.name }))} rows={rows} />
    </WorkspaceShell>
  );
}
