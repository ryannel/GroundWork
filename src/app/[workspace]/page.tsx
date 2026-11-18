import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { modelLandscapeOf } from '@/application/model-landscape';
import { modelWorkspaceNavOf } from '@/application/model-navigation';
import { areaLandscapeOf } from '@/application/workspace-landscape-areas';
import { ModelTodayOverlays, TodaySearch } from '@/features/plan';
import { AreaLandscapePage, LandscapePage } from '@/features/workspace';
import { readCanonicalModelIndex } from '@/infrastructure/model-index';
import { readModelPlans } from '@/infrastructure/model-plans';

interface Params {
  readonly workspace: string;
}

// Named by its layout: a layout's title template reaches the pages below it, not the page beside it.
export const metadata: Metadata = {};

export default async function WorkspaceRoute({ params }: { readonly params: Promise<Params> }) {
  const { workspace: id } = await params;
  const index = await readCanonicalModelIndex(id);
  if (index === null) notFound();
  const nav = modelWorkspaceNavOf(index, await readModelPlans(id));
  const areas = areaLandscapeOf(index);
  return areas === null ? (
    <LandscapePage
      landscape={modelLandscapeOf(index)}
      nav={nav}
      actions={<TodaySearch />}
      overlays={<ModelTodayOverlays index={index} depth={0} />}
    />
  ) : (
    <AreaLandscapePage
      landscape={areas}
      nav={nav}
      actions={<TodaySearch />}
      overlays={<ModelTodayOverlays index={index} depth={0} />}
    />
  );
}
