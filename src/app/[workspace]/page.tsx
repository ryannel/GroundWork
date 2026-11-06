import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { entryFlowHref } from '@/application/entry-flow-paths';
import { landscapeOf } from '@/application/workspace-landscape';
import { areaLandscapeOf } from '@/application/workspace-landscape-areas';
import { workspaceNavOf } from '@/application/workspace-nav';
import { TodayOverlays, TodaySearch } from '@/features/plan';
import { AreaLandscapePage, LandscapePage } from '@/features/workspace';
import { readModelIfCanonical } from '@/infrastructure/canonical-model';
import { todayData } from '@/infrastructure/today-data';
import { readAuthoredLandscape } from '@/infrastructure/workspace-landscape';

interface Params {
  readonly workspace: string;
}

// Named by its layout: a layout's title template reaches the pages below it, not the page beside it.
export const metadata: Metadata = {};

export default async function WorkspaceRoute({ params }: { readonly params: Promise<Params> }) {
  const { workspace: id } = await params;
  if (await readModelIfCanonical(id)) redirect(entryFlowHref(id));
  const data = await todayData(id);
  if (data === null) notFound();
  const { workspace, today, plans } = data;
  const authored = await readAuthoredLandscape(id);
  const nav = workspaceNavOf(workspace, plans, { today: today.model }, data.programmes);
  const overlays = <TodayOverlays depth={0} workspace={workspace} />;
  if (authored !== null) {
    return (
      <AreaLandscapePage
        actions={<TodaySearch />}
        landscape={areaLandscapeOf(workspace, authored)}
        nav={nav}
        overlays={overlays}
      />
    );
  }
  return (
    <LandscapePage
      actions={<TodaySearch />}
      landscape={landscapeOf(workspace, today.model)}
      nav={nav}
      overlays={overlays}
    />
  );
}
