import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { modelLanguageOf } from '@/application/model-language';
import { ModelTodayOverlays, TodaySearch } from '@/features/plan';
import { LanguageOverview, WorkspaceShell } from '@/features/workspace';
import { readCanonicalModelIndex } from '@/infrastructure/model-index';
import { readModelWorkspaceNav } from '@/infrastructure/model-workspace-nav';

interface Params {
  readonly workspace: string;
}

export const metadata: Metadata = { title: 'Language' };

export default async function LanguageRoute({ params }: { readonly params: Promise<Params> }) {
  const { workspace: id } = await params;
  const native = await readCanonicalModelIndex(id);
  if (native === null) notFound();
  return (
    <WorkspaceShell
      workspace={native.model}
      actions={<TodaySearch />}
      nav={await readModelWorkspaceNav(native, { section: 'language' })}
      overlays={<ModelTodayOverlays index={native} depth={1} />}
      title="Language"
    >
      <LanguageOverview page={modelLanguageOf(native)} />
    </WorkspaceShell>
  );
}
