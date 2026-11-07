import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { findPage } from '@/application/plan-navigation';
import { ModelPlanPage } from '@/features/plan';
import { modelPlanData, type ModelPlanParams } from '@/infrastructure/model-plan-data';
import { paramOrNull, type SearchParams } from '@/shared/search-params';

interface Params extends ModelPlanParams {
  readonly chapter: string;
  readonly screen: string;
}

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<Params>;
}): Promise<Metadata> {
  const { chapter, screen, ...at } = await params;
  const data = await modelPlanData({ workspace: at.workspace, slug: at.plan });
  const page = data === null ? null : findPage(data.outline, chapter, screen);
  if (data === null || page === null) return {};
  return { title: `${page.title} · ${data.outline.title}` };
}

export default async function PlanScreenRoute({
  params,
  searchParams,
}: {
  readonly params: Promise<Params>;
  readonly searchParams: Promise<SearchParams>;
}) {
  const { chapter, screen, ...at } = await params;
  const data = await modelPlanData(
    { workspace: at.workspace, slug: at.plan },
    chapter === 'versions',
  );
  if (data === null || findPage(data.outline, chapter, screen) === null) notFound();
  const query = await searchParams;
  return (
    <ModelPlanPage
      {...data}
      chapter={chapter}
      screen={screen}
      lens={paramOrNull(query.team)}
      searchParams={query}
    />
  );
}
