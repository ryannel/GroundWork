import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { workspaceNavOf } from '@/application/workspace-nav';
import { systemHref, workspaceHref } from '@/application/workspace-paths';
import { partnersVM } from '@/application/workspace-work/partners';
import { TodayOverlays, TodaySearch } from '@/features/plan';
import { PartnersPage, WorkspaceShell } from '@/features/workspace';
import { todayData } from '@/infrastructure/today-data';
import { readWorkspacePlanIndex } from '@/infrastructure/workspace-plan-index';

interface Params {
  readonly workspace: string;
}

export const metadata: Metadata = { title: 'Partners' };

export default async function PartnersRoute({ params }: { readonly params: Promise<Params> }) {
  const { workspace: id } = await params;
  const [data, index] = await Promise.all([todayData(id), readWorkspacePlanIndex(id)]);
  if (data === null || index === null) notFound();
  const { workspace, today, plans } = data;
  const now = new Date();
  const systems = workspace.domains.flatMap((domain) =>
    domain.systems.map((system) => ({
      id: system.id,
      name: system.name,
      href: systemHref({ workspace: workspace.id, domain: domain.id, system: system.id }),
      team: system.team,
    })),
  );
  return (
    <WorkspaceShell
      actions={<TodaySearch />}
      nav={workspaceNavOf(
        workspace,
        plans,
        { section: 'partners', today: today.model },
        data.programmes,
      )}
      overlays={<TodayOverlays depth={1} workspace={workspace} />}
      title="Partners"
      trail={[
        { label: 'Workspaces', href: '/' },
        { label: workspace.name, href: workspaceHref(workspace.id) },
      ]}
    >
      <PartnersPage rows={partnersVM(index, systems, now.toISOString())} today={now} />
    </WorkspaceShell>
  );
}
