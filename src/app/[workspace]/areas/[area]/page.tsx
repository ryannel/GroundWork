import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { areaViewOf } from '@/application/workspace-area';
import { workspaceNavOf } from '@/application/workspace-nav';
import { TodayOverlays, TodaySearch } from '@/features/plan';
import { AreaPage } from '@/features/workspace';
import { readExplorerManifest } from '@/infrastructure/service-explorer-files';
import { todayData } from '@/infrastructure/today-data';
import { readAuthoredLandscape } from '@/infrastructure/workspace-landscape';
import { firstParam, type SearchParams } from '@/shared/search-params';

interface Params {
  readonly workspace: string;
  readonly area: string;
}

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<Params>;
}): Promise<Metadata> {
  const { workspace: id, area } = await params;
  const landscape = await readAuthoredLandscape(id);
  const name = landscape?.areas.find((each) => each.id === area)?.name;
  return name === undefined ? {} : { title: name };
}

export default async function AreaRoute({
  params,
  searchParams,
}: {
  readonly params: Promise<Params>;
  readonly searchParams: Promise<SearchParams>;
}) {
  const { workspace: id, area } = await params;
  const [data, landscape, query] = await Promise.all([
    todayData(id),
    readAuthoredLandscape(id),
    searchParams,
  ]);
  if (data === null || landscape === null) notFound();
  const explorer = await readExplorerManifest(id);
  const view = areaViewOf({
    workspace: data.workspace,
    landscape,
    area,
    explorer,
    model: data.today.model,
    attribution: data.today.attribution,
  });
  if (view === null) notFound();
  return (
    <AreaPage
      initialFlow={firstParam(query.flow)}
      actions={<TodaySearch />}
      nav={workspaceNavOf(
        data.workspace,
        data.plans,
        {
          section: 'area',
          key: area,
          today: data.today.model,
        },
        data.programmes,
      )}
      overlays={<TodayOverlays depth={2} workspace={data.workspace} />}
      view={view}
    />
  );
}
