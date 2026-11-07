import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { modelReferenceOf } from '@/application/model-reference';
import { ModelTodayOverlays, ModelTodayReference, TodaySearch } from '@/features/plan';
import { WorkspaceShell } from '@/features/workspace';
import { readCanonicalModelIndex } from '@/infrastructure/model-index';
import { readModelWorkspaceNav } from '@/infrastructure/model-workspace-nav';

interface Params {
  readonly workspace: string;
}

export const metadata: Metadata = { title: 'Reference' };

export default async function ReferenceRoute({ params }: { readonly params: Promise<Params> }) {
  const { workspace: id } = await params;
  const native = await readCanonicalModelIndex(id);
  if (native === null) notFound();
  return (
    <WorkspaceShell
      workspace={native.model}
      title="Reference"
      actions={<TodaySearch />}
      overlays={<ModelTodayOverlays index={native} depth={1} />}
      nav={await readModelWorkspaceNav(native, { section: 'reference' })}
    >
      <ModelTodayReference workspace={native.model.id} kinds={modelReferenceOf(native)} />
    </WorkspaceShell>
  );
}
