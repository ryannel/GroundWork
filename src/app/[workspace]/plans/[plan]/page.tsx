import { notFound } from 'next/navigation';

import { PlanErrors, PlanPage } from '@/features/plan';
import { planData, planFailure, planParams, type PlanParams } from '@/infrastructure/plan-data';
import { NOTHING, orNothing } from '@/shared/static-params';

export const dynamicParams = false;

export async function generateStaticParams(): Promise<PlanParams[]> {
  return orNothing(await planParams(), { workspace: NOTHING, plan: NOTHING });
}

export default async function PlanCoverRoute({ params }: { readonly params: Promise<PlanParams> }) {
  const at = await params;
  const data = await planData(at);
  if (data !== null) return <PlanPage {...data} />;
  const failure = await planFailure(at);
  if (failure === null) notFound();
  return <PlanErrors {...failure} />;
}
