import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { workspaceNavOf } from '@/application/workspace-nav';
import { workspaceHref } from '@/application/workspace-paths';
import { workspaceValueFlowsOf } from '@/application/workspace-value-flows';
import { TodayOverlays, TodaySearch } from '@/features/plan';
import { ValueFlowsPage, WorkspaceShell } from '@/features/workspace';
import { todayData } from '@/infrastructure/today-data';
import { readAuthoredLandscape } from '@/infrastructure/workspace-landscape';

export const metadata: Metadata = { title: 'Value Flows' };

export default async function ValueFlowsRoute({
  params,
}: {
  readonly params: Promise<{ readonly workspace: string }>;
}) {
  const { workspace: id } = await params;
  const [data, landscape] = await Promise.all([todayData(id), readAuthoredLandscape(id)]);
  if (data === null) notFound();
  return (
    <WorkspaceShell
      title="Value Flows"
      actions={<TodaySearch />}
      nav={workspaceNavOf(
        data.workspace,
        data.plans,
        {
          section: 'value-flows',
          today: data.today.model,
        },
        data.programmes,
      )}
      overlays={<TodayOverlays depth={1} workspace={data.workspace} />}
      trail={[
        { label: 'Workspaces', href: '/' },
        { label: data.workspace.name, href: workspaceHref(id) },
      ]}
    >
      <ValueFlowsPage areas={workspaceValueFlowsOf(data.workspace, data.today.model, landscape)} />
    </WorkspaceShell>
  );
}
