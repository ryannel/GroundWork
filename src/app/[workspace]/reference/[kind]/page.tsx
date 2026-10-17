import { notFound } from 'next/navigation';

import { referenceHref } from '@/application/today-reader';
import { referenceOf } from '@/application/today-reference';
import { workspaceNavOf } from '@/application/workspace-nav';
import { workspaceHref } from '@/application/workspace-paths';
import { TodayCatalogue, TodayOverlays, TodaySearch } from '@/features/plan';
import { WorkspaceShell } from '@/features/workspace';
import { todayData } from '@/infrastructure/today-data';
import { readWorkspaces } from '@/infrastructure/workspace-store';
import { NOTHING, orNothing } from '@/shared/static-params';

interface Params {
  readonly workspace: string;
  readonly kind: string;
}

export const dynamicParams = false;

export async function generateStaticParams(): Promise<Params[]> {
  const workspaces = await readWorkspaces();
  const lists = await Promise.all(
    workspaces.map(async ({ id }) => {
      const data = await todayData(id);
      return data === null
        ? []
        : referenceOf(data.today.model).map(({ kind }) => ({ workspace: id, kind }));
    }),
  );
  return orNothing(lists.flat(), { workspace: NOTHING, kind: NOTHING });
}

export default async function CatalogueRoute({ params }: { readonly params: Promise<Params> }) {
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
      <TodayCatalogue kind={kind} model={today.model} workspace={workspace.id} />
    </WorkspaceShell>
  );
}
