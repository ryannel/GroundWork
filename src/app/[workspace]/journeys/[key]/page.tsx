import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { modelJourneyAt, modelJourneysOf, modelJourneyWalkOf } from '@/application/model-journeys';
import { journeyHref, journeysHref } from '@/application/today-reader';
import { workspaceHref } from '@/application/workspace-paths';
import { ModelTodayOverlays, ModelJourney, TodaySearch } from '@/features/plan';
import { WorkspaceShell } from '@/features/workspace';
import { readCanonicalModelIndex } from '@/infrastructure/model-index';
import { readModelWorkspaceNav } from '@/infrastructure/model-workspace-nav';

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
  const native = await readCanonicalModelIndex(id);
  return {
    title: native === null ? 'Journeys' : (modelJourneyAt(native, key)?.title ?? 'Journeys'),
  };
}

export default async function JourneyRoute({ params }: { readonly params: Promise<Params> }) {
  const { workspace: id, key } = await params;
  const native = await readCanonicalModelIndex(id);
  if (native === null) notFound();
  const walk = modelJourneyWalkOf(native, key);
  if (walk === null) notFound();
  const all = modelJourneysOf(native);
  const position = all.findIndex((record) => record.id === walk.journey.id);
  const beside = (by: number): string | null => {
    const other = all[position + by];
    return other === undefined ? null : journeyHref(id, other.key);
  };
  return (
    <WorkspaceShell
      workspace={native.model}
      nav={await readModelWorkspaceNav(native, { section: 'journeys', key: walk.journey.key })}
      actions={<TodaySearch />}
      overlays={
        <ModelTodayOverlays index={native} depth={2} previous={beside(-1)} next={beside(1)} />
      }
      title={walk.journey.title}
      trail={[
        { label: 'Workspaces', href: '/' },
        { label: native.model.name, href: workspaceHref(id) },
        { label: 'Journeys', href: journeysHref(id) },
      ]}
    >
      <ModelJourney walk={walk} labelOf={native.label} />
    </WorkspaceShell>
  );
}
