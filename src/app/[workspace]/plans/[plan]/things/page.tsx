import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ThingPage } from '@/features/plan';
import { planData, type PlanParams } from '@/infrastructure/plan-data';
import { firstParam, type SearchParams } from '@/shared/search-params';

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<PlanParams>;
}): Promise<Metadata> {
  const data = await planData(await params);
  return data === null ? { title: 'Things' } : { title: `Things · ${data.outline.title}` };
}

export default async function ThingRoute({
  params,
  searchParams,
}: {
  readonly params: Promise<PlanParams>;
  readonly searchParams: Promise<SearchParams>;
}) {
  const data = await planData(await params);
  if (data === null) notFound();
  const { id } = await searchParams;
  return <ThingPage {...data} token={firstParam(id)} />;
}
