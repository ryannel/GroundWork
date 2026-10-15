import { notFound } from 'next/navigation';

import { findPage } from '@/application/plan-pages';
import { PlanPage } from '@/features/plan';
import { planData, screenPaths, type PlanParams } from '@/infrastructure/plan-data';
import { planRevision } from '@/infrastructure/plan-revision';

interface Params extends PlanParams {
  readonly chapter: string;
  readonly screen: string;
}

export const dynamicParams = false;

export async function generateStaticParams(): Promise<Params[]> {
  return screenPaths();
}

export default async function PlanScreenRoute({ params }: { readonly params: Promise<Params> }) {
  const { chapter, screen, ...at } = await params;
  const data = await planData(at);
  if (data === null || findPage(data.outline, chapter, screen) === null) notFound();
  const versions = chapter === 'versions' ? await planRevision(at.workspace, at.plan) : null;
  return <PlanPage {...data} chapter={chapter} screen={screen} versions={versions} />;
}
