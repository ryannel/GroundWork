import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { modelProgrammeOf, modelWorkLabelsOf } from '@/application/model-workspace-work';
import { programmeHref, programmesHref, workspaceHref } from '@/application/workspace-paths';
import { ModelTodayOverlays, ModelProgrammePageView, TodaySearch } from '@/features/plan';
import { WorkspaceShell } from '@/features/workspace';
import { readCanonicalModelIndex } from '@/infrastructure/model-index';
import { readModelWorkspaceNav } from '@/infrastructure/model-workspace-nav';
import { readModelWorkspaceWork } from '@/infrastructure/model-workspace-work';
import { firstParam, type SearchParams } from '@/shared/search-params';

interface Params {
  readonly workspace: string;
  readonly programme: string;
}

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<Params>;
}): Promise<Metadata> {
  const { workspace, programme } = await params;
  const native = await readCanonicalModelIndex(workspace);
  if (native === null) return {};
  const page = modelProgrammeOf(native, programme, []);
  return page === null ? {} : { title: page.programme.title };
}

export default async function ProgrammeRoute({
  params,
  searchParams,
}: {
  readonly params: Promise<Params>;
  readonly searchParams: Promise<SearchParams>;
}) {
  const { workspace: id, programme } = await params;
  const native = await readCanonicalModelIndex(id);
  if (native === null) notFound();
  const entries = await readModelWorkspaceWork(id);
  const query = await searchParams;
  const page = modelProgrammeOf(native, programme, entries);
  if (page === null) notFound();
  return (
    <WorkspaceShell
      workspace={native.model}
      nav={await readModelWorkspaceNav(native, { section: 'programmes' })}
      title={page.programme.title}
      actions={<TodaySearch />}
      overlays={<ModelTodayOverlays index={native} depth={2} />}
      trail={[
        { label: 'Workspaces', href: '/' },
        { label: native.model.name, href: workspaceHref(native.model.id) },
        { label: 'Programmes', href: programmesHref(native.model.id) },
      ]}
    >
      <ModelProgrammePageView
        page={page}
        labels={modelWorkLabelsOf(native, entries, page)}
        href={programmeHref(id, programme)}
        selected={firstParam(query.plan)}
        canInspect={(reference) => native.get(reference) !== null}
      />
    </WorkspaceShell>
  );
}
