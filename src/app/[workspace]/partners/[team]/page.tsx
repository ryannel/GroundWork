import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { modelPartnerOf, modelWorkLabelsOf } from '@/application/model-workspace-work';
import { partnersHref, workspaceHref } from '@/application/workspace-paths';
import { ModelTodayOverlays, ModelPartnerPageView, TodaySearch } from '@/features/plan';
import { WorkspaceShell } from '@/features/workspace';
import { readCanonicalModelIndex } from '@/infrastructure/model-index';
import { readModelWorkspaceNav } from '@/infrastructure/model-workspace-nav';
import { readModelWorkspaceWork } from '@/infrastructure/model-workspace-work';

interface Params {
  readonly workspace: string;
  readonly team: string;
}

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<Params>;
}): Promise<Metadata> {
  const { workspace, team } = await params;
  const native = await readCanonicalModelIndex(workspace);
  if (native === null) return {};
  const page = modelPartnerOf(native, team, []);
  return page === null ? {} : { title: page.team.name };
}

export default async function PartnerRoute({ params }: { readonly params: Promise<Params> }) {
  const { workspace: id, team } = await params;
  const native = await readCanonicalModelIndex(id);
  if (native === null) notFound();
  const entries = await readModelWorkspaceWork(id);
  const page = modelPartnerOf(native, team, entries);
  if (page === null) notFound();
  return (
    <WorkspaceShell
      workspace={native.model}
      nav={await readModelWorkspaceNav(native, { section: 'partners' })}
      title={page.team.name}
      actions={<TodaySearch />}
      overlays={<ModelTodayOverlays index={native} depth={2} />}
      trail={[
        { label: 'Workspaces', href: '/' },
        { label: native.model.name, href: workspaceHref(native.model.id) },
        { label: 'Partners', href: partnersHref(native.model.id) },
      ]}
    >
      <ModelPartnerPageView page={page} labels={modelWorkLabelsOf(native, entries, page)} />
    </WorkspaceShell>
  );
}
