import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { modelPartnerRowsOf } from '@/application/model-workspace-work';
import { ModelTodayOverlays, TodaySearch } from '@/features/plan';
import { PartnersPage, WorkspaceShell } from '@/features/workspace';
import { readCanonicalModelIndex } from '@/infrastructure/model-index';
import { readModelWorkspaceNav } from '@/infrastructure/model-workspace-nav';
import { readModelWorkspaceWork } from '@/infrastructure/model-workspace-work';

interface Params {
  readonly workspace: string;
}

export const metadata: Metadata = { title: 'Partners' };

export default async function PartnersRoute({ params }: { readonly params: Promise<Params> }) {
  const { workspace: id } = await params;
  const native = await readCanonicalModelIndex(id);
  if (native === null) notFound();
  const entries = await readModelWorkspaceWork(id);
  return (
    <WorkspaceShell
      workspace={native.model}
      nav={await readModelWorkspaceNav(native, { section: 'partners' })}
      title="Partners"
      actions={<TodaySearch />}
      overlays={<ModelTodayOverlays index={native} depth={1} />}
    >
      <PartnersPage rows={modelPartnerRowsOf(native, entries, new Date().toISOString())} />
    </WorkspaceShell>
  );
}
