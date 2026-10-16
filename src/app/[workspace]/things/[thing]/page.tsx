import { notFound } from 'next/navigation';

import { thingByToken, thingTokens } from '@/application/plan-pages-things';
import { workspaceNavOf } from '@/application/workspace-nav';
import { workspaceHref } from '@/application/workspace-paths';
import { TodayOverlays, TodaySearch, TodayThing } from '@/features/plan';
import { WorkspaceShell } from '@/features/workspace';
import { todayData } from '@/infrastructure/today-data';
import { readWorkspaces } from '@/infrastructure/workspace-store';

interface Params {
  readonly workspace: string;
  readonly thing: string;
}

export const dynamicParams = false;

export async function generateStaticParams(): Promise<Params[]> {
  const workspaces = await readWorkspaces();
  const lists = await Promise.all(
    workspaces.map(async ({ id }) => {
      const data = await todayData(id);
      return data === null
        ? []
        : thingTokens(data.today.model).map((token) => ({ workspace: id, thing: token }));
    }),
  );
  return lists.flat();
}

export default async function TodayThingRoute({ params }: { readonly params: Promise<Params> }) {
  const { workspace: id, thing: token } = await params;
  const data = await todayData(id);
  const thing = data === null ? null : thingByToken(data.today.model, token);
  if (data === null || thing === null) notFound();
  const { workspace, today, plans } = data;
  return (
    <WorkspaceShell
      actions={<TodaySearch />}
      nav={workspaceNavOf(workspace, plans, {})}
      overlays={<TodayOverlays depth={2} workspace={workspace} />}
      title={today.model.label(thing)}
      trail={[
        { label: 'Workspaces', href: '/' },
        { label: workspace.name, href: workspaceHref(workspace.id) },
      ]}
    >
      <TodayThing
        attribution={today.attribution}
        id={thing}
        model={today.model}
        workspace={workspace}
      />
    </WorkspaceShell>
  );
}
