import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { modelReferenceOf, modelReferencePage } from '@/application/model-reference';
import { referenceHref } from '@/application/today-reader';
import { workspaceHref } from '@/application/workspace-paths';
import { ModelTodayOverlays, ModelTodayCatalogue, TodaySearch } from '@/features/plan';
import { WorkspaceShell } from '@/features/workspace';
import { readCanonicalModelIndex } from '@/infrastructure/model-index';
import { readModelWorkspaceNav } from '@/infrastructure/model-workspace-nav';
import type { SearchParams } from '@/shared/search-params';

interface Params {
  readonly workspace: string;
  readonly kind: string;
}

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<Params>;
}): Promise<Metadata> {
  const { workspace: id, kind } = await params;
  const native = await readCanonicalModelIndex(id);
  if (native === null) return { title: 'Reference' };
  return {
    title: modelReferenceOf(native).find((entry) => entry.kind === kind)?.title ?? 'Reference',
  };
}

export default async function CatalogueRoute({
  params,
  searchParams,
}: {
  readonly params: Promise<Params>;
  readonly searchParams: Promise<SearchParams>;
}) {
  const { workspace: id, kind } = await params;
  const native = await readCanonicalModelIndex(id);
  if (native === null) notFound();
  const entry = modelReferenceOf(native).find((candidate) => candidate.kind === kind);
  const page = modelReferencePage(native, kind, await searchParams);
  if (entry === undefined || page === null) notFound();
  return (
    <WorkspaceShell
      workspace={native.model}
      title={entry.title}
      actions={<TodaySearch />}
      overlays={<ModelTodayOverlays index={native} depth={2} />}
      nav={await readModelWorkspaceNav(native, { section: 'reference', key: kind })}
      trail={[
        { label: 'Workspaces', href: '/' },
        { label: native.model.name, href: workspaceHref(native.model.id) },
        { label: 'Reference', href: referenceHref(native.model.id) },
      ]}
    >
      <ModelTodayCatalogue entry={entry} page={page} />
    </WorkspaceShell>
  );
}
