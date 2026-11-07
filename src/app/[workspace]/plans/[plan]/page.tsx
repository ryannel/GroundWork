import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ModelPlanPage } from '@/features/plan';
import { modelPlanData, type ModelPlanParams } from '@/infrastructure/model-plan-data';
import { paramOrNull, type SearchParams } from '@/shared/search-params';

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<ModelPlanParams>;
}): Promise<Metadata> {
  const at = await params;
  const data = await modelPlanData({ workspace: at.workspace, slug: at.plan });
  return data === null ? {} : { title: data.outline.title };
}

export default async function PlanCoverRoute({
  params,
  searchParams,
}: {
  readonly params: Promise<ModelPlanParams>;
  readonly searchParams: Promise<SearchParams>;
}) {
  const at = await params;
  const data = await modelPlanData({ workspace: at.workspace, slug: at.plan });
  if (data === null) notFound();
  const { team } = await searchParams;
  return <ModelPlanPage {...data} lens={paramOrNull(team)} />;
}
