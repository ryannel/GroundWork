import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { modelAreaViewOf } from '@/application/model-area';
import { modelWorkspaceNavOf } from '@/application/model-navigation';
import { buildId, hasPrefix } from '@/domain/ids';
import { ModelTodayOverlays, TodaySearch } from '@/features/plan';
import { AreaPage } from '@/features/workspace';
import { readCanonicalModelIndex } from '@/infrastructure/model-index';
import { readModelPlans } from '@/infrastructure/model-plans';
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
  const index = await readCanonicalModelIndex(id);
  if (index === null) return {};
  const node = index.get(hasPrefix(area, 'area') ? area : buildId('area', area));
  return node?.kind === 'area' ? { title: index.label(node.id) } : {};
}

export default async function AreaRoute({
  params,
  searchParams,
}: {
  readonly params: Promise<Params>;
  readonly searchParams: Promise<SearchParams>;
}) {
  const { workspace: id, area } = await params;
  const index = await readCanonicalModelIndex(id);
  if (index === null) notFound();
  const view = modelAreaViewOf(index, area);
  if (view === null) notFound();
  const query = await searchParams;
  return (
    <AreaPage
      initialFlow={firstParam(query.flow)}
      actions={<TodaySearch />}
      nav={modelWorkspaceNavOf(index, await readModelPlans(id), { section: 'area', key: area })}
      overlays={<ModelTodayOverlays index={index} depth={2} />}
      view={view}
    />
  );
}
