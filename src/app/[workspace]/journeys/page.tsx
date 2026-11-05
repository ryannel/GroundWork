import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { workspaceNavOf } from '@/application/workspace-nav';
import { workspaceHref } from '@/application/workspace-paths';
import { TodayJourneys, TodayOverlays, TodaySearch } from '@/features/plan';
import { WorkspaceShell } from '@/features/workspace';
import { todayData } from '@/infrastructure/today-data';

interface Params {
  readonly workspace: string;
}

export const metadata: Metadata = { title: 'Journeys' };

export default async function JourneysRoute({ params }: { readonly params: Promise<Params> }) {
  const { workspace: id } = await params;
  const data = await todayData(id);
  if (data === null) notFound();
  const { workspace, today, plans } = data;
  return (
    <WorkspaceShell
      actions={<TodaySearch />}
      nav={workspaceNavOf(
        workspace,
        plans,
        { section: 'journeys', today: today.model },
        data.programmes,
      )}
      overlays={<TodayOverlays depth={1} workspace={workspace} />}
      title="Journeys"
      trail={[
        { label: 'Workspaces', href: '/' },
        { label: workspace.name, href: workspaceHref(workspace.id) },
      ]}
    >
      <TodayJourneys model={today.model} workspace={workspace} />
    </WorkspaceShell>
  );
}
