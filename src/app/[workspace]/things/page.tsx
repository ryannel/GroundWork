import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { thingByToken } from '@/application/plan-pages-things';
import { workspaceNavOf } from '@/application/workspace-nav';
import { workspaceHref } from '@/application/workspace-paths';
import { TodayOverlays, TodaySearch, TodayThing } from '@/features/plan';
import { WorkspaceShell } from '@/features/workspace';
import { todayData } from '@/infrastructure/today-data';
import { firstParam, type SearchParams } from '@/shared/search-params';
import { Text } from '@/ui/text';

interface Params {
  readonly workspace: string;
}

// A thing is looked up like the reference, so the rail opens there rather than on the map.
export const metadata: Metadata = { title: 'Things' };

export default async function TodayThingRoute({
  params,
  searchParams,
}: {
  readonly params: Promise<Params>;
  readonly searchParams: Promise<SearchParams>;
}) {
  const { workspace: id } = await params;
  const data = await todayData(id);
  if (data === null) notFound();
  const { workspace, today, plans } = data;
  const { id: token } = await searchParams;
  const thing = thingByToken(today.model, firstParam(token));
  return (
    <WorkspaceShell
      actions={<TodaySearch />}
      nav={workspaceNavOf(workspace, plans, { section: 'reference', today: today.model })}
      overlays={<TodayOverlays depth={1} workspace={workspace} />}
      title="Things"
      trail={[
        { label: 'Workspaces', href: '/' },
        { label: workspace.name, href: workspaceHref(workspace.id) },
      ]}
    >
      {thing === null ? (
        <Text as="p" tone="muted">
          Nothing here goes by that name.
        </Text>
      ) : (
        <TodayThing
          attribution={today.attribution}
          id={thing}
          model={today.model}
          workspace={workspace}
        />
      )}
    </WorkspaceShell>
  );
}
