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
  const model = index.model;
  const nav = modelWorkspaceNavOf(index, await readModelPlans(id));
  return model.landscape === null ? (
    <LandscapePage
      landscape={modelLandscapeOf(index)}
      nav={nav}
      actions={<TodaySearch />}
      overlays={<ModelTodayOverlays index={index} depth={0} />}
    />
  ) : (
    <AreaLandscapePage
      landscape={areaLandscapeOf(model, model.landscape)}
      nav={nav}
      actions={<TodaySearch />}
      overlays={<ModelTodayOverlays index={index} depth={0} />}
    />
  );
}
