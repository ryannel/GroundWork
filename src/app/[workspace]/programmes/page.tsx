import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { workspaceNavOf } from '@/application/workspace-nav';
import { workspaceHref } from '@/application/workspace-paths';
import { programmeRowsOf } from '@/application/workspace-work/programme-page';
import { TodayOverlays, TodaySearch } from '@/features/plan';
import { ProgrammesPage, WorkspaceShell } from '@/features/workspace';
import { todayData } from '@/infrastructure/today-data';
import { readWorkspacePlanIndex } from '@/infrastructure/workspace-plan-index';

interface Params {
  readonly workspace: string;
}

export const metadata: Metadata = { title: 'Programmes' };

export default async function ProgrammesRoute({ params }: { readonly params: Promise<Params> }) {
  const { workspace: id } = await params;
  const [data, index] = await Promise.all([todayData(id), readWorkspacePlanIndex(id)]);
  if (data === null || index === null) notFound();
  const { workspace, today, plans } = data;
  return (
    <WorkspaceShell
      actions={<TodaySearch />}
      nav={workspaceNavOf(
        workspace,
        plans,
        { section: 'programmes', today: today.model },
        data.programmes,
      )}
      overlays={<TodayOverlays depth={1} workspace={workspace} />}
      title="Programmes"
      trail={[
        { label: 'Workspaces', href: '/' },
        { label: workspace.name, href: workspaceHref(workspace.id) },
      ]}
    >
      <ProgrammesPage rows={programmeRowsOf(index)} />
    </WorkspaceShell>
  );
}
