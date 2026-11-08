import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { EntryHistoryPage, HistoryError } from '@/features/evidence';
import { readEntryHistory } from '@/infrastructure/entry-history';
import { workspaceFolder } from '@/infrastructure/workspace-folders';
import { paramOrNull, type SearchParams } from '@/shared/search-params';

export const metadata: Metadata = { title: 'Historical entries' };

export default async function ExplorerRoute({
  params,
  searchParams,
}: {
  readonly params: Promise<{ readonly workspace: string }>;
  readonly searchParams: Promise<SearchParams>;
}) {
  const { workspace } = await params;
  const query = await searchParams;
  const history = await readEntryHistory(workspace, {
    scope: paramOrNull(query.scope) ?? undefined,
    service: paramOrNull(query.service) ?? undefined,
    page: paramOrNull(query.page) ?? undefined,
    node: paramOrNull(query.node) ?? undefined,
  }).catch(() => 'unavailable' as const);
  if (history === 'unavailable') return <HistoryError />;
  if (history === null && (await workspaceFolder(workspace)) === null) notFound();
  return (
    <EntryHistoryPage
      history={history ?? { kind: 'directory', scopes: [] }}
      workspace={workspace}
    />
  );
}
