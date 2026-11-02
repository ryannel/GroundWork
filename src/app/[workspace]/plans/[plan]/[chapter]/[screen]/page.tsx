import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { findPage } from '@/application/plan-pages';
import { PlanPage } from '@/features/plan';
import { planData, type PlanParams } from '@/infrastructure/plan-data';
import { planRevision } from '@/infrastructure/plan-revision';
import { paramOrNull, type SearchParams } from '@/shared/search-params';

interface Params extends PlanParams {
  readonly chapter: string;
  readonly screen: string;
}

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<Params>;
}): Promise<Metadata> {
  const { chapter, screen, ...at } = await params;
  const data = await planData(at);
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
  const data = await planData(at);
  if (data === null || findPage(data.outline, chapter, screen) === null) notFound();
  const versions = chapter === 'versions' ? await planRevision(at.workspace, at.plan) : null;
  const query = await searchParams;
  const { team } = query;
  const lens = paramOrNull(team);
  return (
    <PlanPage
      {...data}
      chapter={chapter}
      lens={lens}
      screen={screen}
      versions={versions}
      searchParams={query}
    />
  );
}
