import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { todayJourneysOf } from '@/application/today-journeys';
import { journeyHref, journeysHref } from '@/application/today-reader';
import { workspaceNavOf } from '@/application/workspace-nav';
import { workspaceHref } from '@/application/workspace-paths';
import { TodayJourney, TodayOverlays, TodaySearch } from '@/features/plan';
import { WorkspaceShell } from '@/features/workspace';
import { todayData } from '@/infrastructure/today-data';

interface Params {
  readonly workspace: string;
  readonly key: string;
}

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<Params>;
}): Promise<Metadata> {
  const { workspace: id, key } = await params;
  const data = await todayData(id);
  const journey =
    data === null ? undefined : todayJourneysOf(data.today.model).find((j) => j.key === key);
  return { title: journey?.title ?? 'Journeys' };
}

export default async function JourneyRoute({ params }: { readonly params: Promise<Params> }) {
  const { workspace: id, key } = await params;
  const data = await todayData(id);
  const journeys = data === null ? [] : todayJourneysOf(data.today.model);
  const at = journeys.findIndex((journey) => journey.key === key);
  const journey = journeys[at];
  if (data === null || journey === undefined) notFound();
  const { workspace, today, plans } = data;
  const beside = (by: -1 | 1): string | null => {
    const other = journeys[at + by];
    return other === undefined ? null : journeyHref(workspace.id, other.key);
  };
  return (
    <WorkspaceShell
      actions={<TodaySearch />}
      nav={workspaceNavOf(
        workspace,
        plans,
        { section: 'journeys', key, today: today.model },
        data.programmes,
      )}
      overlays={
        <TodayOverlays depth={2} next={beside(1)} previous={beside(-1)} workspace={workspace} />
      }
      title={journey.title}
      trail={[
        { label: 'Workspaces', href: '/' },
        { label: workspace.name, href: workspaceHref(workspace.id) },
        { label: 'Journeys', href: journeysHref(workspace.id) },
      ]}
    >
      <TodayJourney journey={key} model={today.model} workspace={workspace.id} />
    </WorkspaceShell>
  );
}
