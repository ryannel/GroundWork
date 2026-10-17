import { notFound } from 'next/navigation';

import { domainMapOf } from '@/application/landscape-domains';
import { workspaceNavOf } from '@/application/workspace-nav';
import { workspaceHref } from '@/application/workspace-paths';
import { TodayOverlays, TodaySearch } from '@/features/plan';
import { PeoplePage, WorkspaceShell } from '@/features/workspace';
import { todayData } from '@/infrastructure/today-data';
import { readWorkspaces } from '@/infrastructure/workspace-store';

interface Params {
  readonly workspace: string;
}

export const dynamicParams = false;

export async function generateStaticParams(): Promise<Params[]> {
  const workspaces = await readWorkspaces();
  return workspaces.map(({ id }) => ({ workspace: id }));
}

export default async function PeopleRoute({ params }: { readonly params: Promise<Params> }) {
  const { workspace: id } = await params;
  const data = await todayData(id);
  if (data === null) notFound();
  const { workspace, today, plans } = data;
  return (
    <WorkspaceShell
      actions={<TodaySearch />}
      nav={workspaceNavOf(workspace, plans, { section: 'people', today: today.model })}
      overlays={<TodayOverlays depth={1} workspace={workspace} />}
      title="People"
      trail={[
        { label: 'Workspaces', href: '/' },
        { label: workspace.name, href: workspaceHref(workspace.id) },
      ]}
    >
      <PeoplePage map={domainMapOf(workspace, today.model)} />
    </WorkspaceShell>
  );
}
