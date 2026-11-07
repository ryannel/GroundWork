import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { modelLandscapeOf } from '@/application/model-landscape';
import { ModelTodayOverlays, TodaySearch } from '@/features/plan';
import { PeoplePage, WorkspaceShell } from '@/features/workspace';
import { readCanonicalModelIndex } from '@/infrastructure/model-index';
import { readModelWorkspaceNav } from '@/infrastructure/model-workspace-nav';

interface Params {
  readonly workspace: string;
}

export const metadata: Metadata = { title: 'People' };

export default async function PeopleRoute({ params }: { readonly params: Promise<Params> }) {
  const { workspace: id } = await params;
  const native = await readCanonicalModelIndex(id);
  if (native === null) notFound();
  return (
    <WorkspaceShell
      workspace={native.model}
      actions={<TodaySearch />}
      nav={await readModelWorkspaceNav(native, { section: 'people' })}
      overlays={<ModelTodayOverlays index={native} depth={1} />}
      title="People"
    >
      <PeoplePage map={modelLandscapeOf(native).map} />
    </WorkspaceShell>
  );
}
