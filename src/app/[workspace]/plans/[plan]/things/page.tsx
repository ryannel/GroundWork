import { notFound } from 'next/navigation';

import { ThingPage } from '@/features/plan';
import { planData, planParams, type PlanParams } from '@/infrastructure/plan-data';
import { NOTHING, orNothing } from '@/shared/static-params';

export const dynamicParams = false;

export async function generateStaticParams(): Promise<PlanParams[]> {
  return orNothing(await planParams(), { workspace: NOTHING, plan: NOTHING });
}

export default async function ThingRoute({ params }: { readonly params: Promise<PlanParams> }) {
  const data = await planData(await params);
  if (data === null) notFound();
  return <ThingPage {...data} />;
}
