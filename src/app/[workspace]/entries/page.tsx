import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { entryFlowPageOf } from '@/application/entry-flow-page';
import { EntryFlowPage } from '@/features/entry-flow';
import { readModelIfCanonical } from '@/infrastructure/canonical-model';
import { readModelPlans } from '@/infrastructure/model-plans';
import type { SearchParams } from '@/shared/search-params';

interface Params {
  readonly workspace: string;
}
export const metadata: Metadata = { title: 'Entry flows' };
export default async function EntryFlowRoute({
  params,
  searchParams,
}: {
  readonly params: Promise<Params>;
  readonly searchParams: Promise<SearchParams>;
}) {
  const { workspace } = await params;
  const model = await readModelIfCanonical(workspace);
  if (model === null) notFound();
  const data = entryFlowPageOf(model, await readModelPlans(workspace), await searchParams);
  if (data === null) notFound();
  return <EntryFlowPage {...data} />;
}
