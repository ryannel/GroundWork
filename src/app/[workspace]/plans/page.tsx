import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { planRowsOf } from '@/application/plan-index';
import { workspaceNavOf } from '@/application/workspace-nav';
import { workspaceHref } from '@/application/workspace-paths';
import { programmeRowsOf } from '@/application/workspace-work/programme-page';
import { TodayOverlays, TodaySearch } from '@/features/plan';
import { PlansPage, WorkspaceShell } from '@/features/workspace';
import { todayData } from '@/infrastructure/today-data';
import { readWorkspacePlanIndex } from '@/infrastructure/workspace-plan-index';
import { readLoadedPlans } from '@/infrastructure/workspace-plans';

interface Params {
  readonly workspace: string;
}

export const metadata: Metadata = { title: 'Plans' };

export default async function PlansRoute({ params }: { readonly params: Promise<Params> }) {
  const { workspace: id } = await params;
  const data = await todayData(id);
  if (data === null) notFound();
  const { workspace, today, plans } = data;
  const [loaded, index] = await Promise.all([
    readLoadedPlans(workspace.id),
    readWorkspacePlanIndex(workspace.id),
  ]);
  const rows = planRowsOf(workspace, loaded);
  return (
    <WorkspaceShell
      actions={<TodaySearch />}
      nav={workspaceNavOf(
        workspace,
        plans,
        { section: 'plans', today: today.model },
        data.programmes,
      )}
      overlays={<TodayOverlays depth={1} workspace={workspace} />}
      title="Plans"
      trail={[
        { label: 'Workspaces', href: '/' },
        { label: workspace.name, href: workspaceHref(workspace.id) },
      ]}
    >
      <PlansPage
        domains={workspace.domains.map((d) => ({ id: d.id, name: d.name }))}
        programmes={index === null ? [] : programmeRowsOf(index)}
        rows={rows}
      />
    </WorkspaceShell>
  );
}
