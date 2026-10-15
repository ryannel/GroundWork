import { notFound } from 'next/navigation';

import { thingByToken, thingTokens } from '@/application/plan-pages-things';
import { ThingPage } from '@/features/plan';
import { planData, planParams, type PlanParams } from '@/infrastructure/plan-data';

interface Params extends PlanParams {
  readonly thing: string;
}

export const dynamicParams = false;

export async function generateStaticParams(): Promise<Params[]> {
  const plans = await planParams();
  const lists = await Promise.all(
    plans.map(async (at) => {
      const data = await planData(at);
      return data === null ? [] : thingTokens(data.model).map((thing) => ({ ...at, thing }));
    }),
  );
  return lists.flat();
}

export default async function ThingRoute({ params }: { readonly params: Promise<Params> }) {
  const { thing, ...at } = await params;
  const data = await planData(at);
  const id = data === null ? null : thingByToken(data.model, thing);
  if (data === null || id === null) notFound();
  return <ThingPage {...data} id={id} />;
}
