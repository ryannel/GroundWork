import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ModelPlanThingPage } from '@/features/plan';
import { modelPlanData, type ModelPlanParams } from '@/infrastructure/model-plan-data';
import { firstParam, type SearchParams } from '@/shared/search-params';

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<ModelPlanParams>;
}): Promise<Metadata> {
  const at = await params;
  const data = await modelPlanData({ workspace: at.workspace, slug: at.plan });
  return data === null ? { title: 'Things' } : { title: `Things · ${data.outline.title}` };
}

export default async function ThingRoute({
  params,
  searchParams,
}: {
  readonly params: Promise<ModelPlanParams>;
  readonly searchParams: Promise<SearchParams>;
}) {
  const at = await params;
  const data = await modelPlanData({ workspace: at.workspace, slug: at.plan });
  if (data === null) notFound();
  const query = await searchParams;
  return <ModelPlanThingPage {...data} token={firstParam(query.id)} searchParams={query} />;
}
