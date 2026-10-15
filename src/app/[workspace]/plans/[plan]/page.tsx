import { notFound } from 'next/navigation';

import { PlanPage } from '@/features/plan';
import { planData, planParams, type PlanParams } from '@/infrastructure/plan-data';

export const dynamicParams = false;

export async function generateStaticParams(): Promise<PlanParams[]> {
  return planParams();
}

export default async function PlanCoverRoute({ params }: { readonly params: Promise<PlanParams> }) {
  const data = await planData(await params);
  if (data === null) notFound();
  return <PlanPage {...data} />;
}
