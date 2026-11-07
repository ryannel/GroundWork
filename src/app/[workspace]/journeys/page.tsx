import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { modelJourneyIndexOf, modelJourneysOf } from '@/application/model-journeys';
import { journeysHeadline } from '@/application/today-journeys';
import { ModelTodayOverlays, JourneyIndexView, TodaySearch } from '@/features/plan';
import { WorkspaceShell } from '@/features/workspace';
import { readCanonicalModelIndex } from '@/infrastructure/model-index';
import { readModelWorkspaceNav } from '@/infrastructure/model-workspace-nav';

interface Params {
  readonly workspace: string;
}

export const metadata: Metadata = { title: 'Journeys' };

export default async function JourneysRoute({ params }: { readonly params: Promise<Params> }) {
  const { workspace: id } = await params;
  const native = await readCanonicalModelIndex(id);
  if (native === null) notFound();
  return (
    <WorkspaceShell
      workspace={native.model}
      nav={await readModelWorkspaceNav(native, { section: 'journeys' })}
      title="Journeys"
      actions={<TodaySearch />}
      overlays={<ModelTodayOverlays index={native} depth={1} />}
    >
      <JourneyIndexView
        index={modelJourneyIndexOf(native)}
        headline={journeysHeadline(modelJourneysOf(native))}
      />
    </WorkspaceShell>
  );
}
