import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { systemScopeOf } from '@/application/model-scope';
import { partsFor } from '@/application/plan-footprint';
import { workspaceNavOf } from '@/application/workspace-nav';
import { systemPaths } from '@/application/workspace-paths';
import { systemViewOf } from '@/application/workspace-system';
import { FlowList, TodayMap, TodayOverlays, TodaySearch } from '@/features/plan';
import { SystemPage } from '@/features/workspace';
import { todayData } from '@/infrastructure/today-data';
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

// The system page is a layout, so its flows can be pages of their own: picking one fetches only that flow.
export default async function SystemLayout({
  params,
  children,
}: {
  readonly params: Promise<Params>;
  readonly children: ReactNode;
}) {
  const { workspace: id, domain, system } = await params;
  const data = await todayData(id);
  const scope = data === null ? null : systemScopeOf(data.workspace, system);
  const view = data === null ? null : systemViewOf(data.workspace, data.today, { domain, system });
  if (data === null || scope === null || view === null) notFound();
  const { workspace, today, plans } = data;
  const loaded = await readLoadedPlans(workspace.id);
  return (
    <SystemPage
      actions={<TodaySearch />}
      flows={<FlowList flows={view.flows}>{children}</FlowList>}
      map={<TodayMap model={today.model} scope={scope} workspace={workspace} />}
      nav={workspaceNavOf(workspace, plans, { domain, system, today: today.model })}
      overlays={<TodayOverlays depth={2} workspace={workspace} />}
      parts={partsFor(workspace, { domain, system }, loaded)}
      view={view}
    />
  );
}
