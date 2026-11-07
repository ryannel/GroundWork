import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { EntryFlowPage } from '@/features/entry-flow';
import { readEntryFlowPage } from '@/infrastructure/entry-flow-page';
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
  const data = await readEntryFlowPage(workspace, await searchParams);
  if (data === null) notFound();
  return <EntryFlowPage {...data} />;
}
