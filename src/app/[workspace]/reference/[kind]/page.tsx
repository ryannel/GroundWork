import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { referenceHref } from '@/application/today-reader';
import { referenceOf } from '@/application/today-reference';
import { workspaceNavOf } from '@/application/workspace-nav';
import { workspaceHref } from '@/application/workspace-paths';
import { TodayCatalogue, TodayOverlays, TodaySearch } from '@/features/plan';
import { WorkspaceShell } from '@/features/workspace';
import { todayData } from '@/infrastructure/today-data';
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
  const data = await todayData(id);
  const entry =
    data === null ? undefined : referenceOf(data.today.model).find((k) => k.kind === kind);
  return { title: entry?.title ?? 'Reference' };
}

export default async function CatalogueRoute({
  params,
  searchParams,
}: {
  readonly params: Promise<Params>;
  readonly searchParams: Promise<SearchParams>;
}) {
  const { workspace: id, kind } = await params;
  const data = await todayData(id);
  const entry =
    data === null ? undefined : referenceOf(data.today.model).find((k) => k.kind === kind);
  if (data === null || entry === undefined) notFound();
  const { workspace, today, plans } = data;
  return (
    <WorkspaceShell
      actions={<TodaySearch />}
      nav={workspaceNavOf(workspace, plans, {
        section: 'reference',
        key: kind,
        today: today.model,
      })}
      overlays={<TodayOverlays depth={2} workspace={workspace} />}
      title={entry.title}
      trail={[
        { label: 'Workspaces', href: '/' },
        { label: workspace.name, href: workspaceHref(workspace.id) },
        { label: 'Reference', href: referenceHref(workspace.id) },
      ]}
    >
      <TodayCatalogue
        params={await searchParams}
        kind={kind}
        model={today.model}
        workspace={workspace.id}
      />
    </WorkspaceShell>
  );
}
