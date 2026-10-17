import { notFound } from 'next/navigation';

import { landscapeOf } from '@/application/workspace-landscape';
import { workspaceNavOf } from '@/application/workspace-nav';
import { TodayOverlays, TodaySearch } from '@/features/plan';
import { LandscapePage } from '@/features/workspace';
import { todayData } from '@/infrastructure/today-data';
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
  const data = await todayData(id);
  if (data === null) notFound();
  const { workspace, today, plans } = data;
  return (
    <LandscapePage
      actions={<TodaySearch />}
      landscape={landscapeOf(workspace, today.model)}
      nav={workspaceNavOf(workspace, plans, { today: today.model })}
      overlays={<TodayOverlays depth={0} workspace={workspace} />}
    />
  );
}
