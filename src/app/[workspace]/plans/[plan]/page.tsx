import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PlanErrors, PlanPage } from '@/features/plan';
import { planData, planFailure, type PlanParams } from '@/infrastructure/plan-data';
import { paramOrNull, type SearchParams } from '@/shared/search-params';

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<PlanParams>;
}): Promise<Metadata> {
  const at = await params;
  const data = await planData(at);
  if (data !== null) return { title: data.outline.title };
  const failure = await planFailure(at);
  return failure === null ? {} : { title: failure.title ?? failure.slug };
}

export default async function PlanCoverRoute({
  params,
  searchParams,
}: {
  readonly params: Promise<PlanParams>;
  readonly searchParams: Promise<SearchParams>;
}) {
  const at = await params;
  const data = await planData(at);
  if (data !== null) {
    const { team } = await searchParams;
    return <PlanPage {...data} lens={paramOrNull(team)} />;
  }
  const failure = await planFailure(at);
  if (failure === null) notFound();
  return <PlanErrors {...failure} />;
}
