import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { EntryHistoryPage } from '@/features/evidence';
import { ExplorerPublication } from '@/features/service-explorer';
import { WorkspaceShell } from '@/features/workspace';
import { readEntryHistory } from '@/infrastructure/entry-history';
import { readCanonicalModelIndex } from '@/infrastructure/model-index';
import { readModelWorkspaceNav } from '@/infrastructure/model-workspace-nav';
import { readExplorerCatalogue } from '@/infrastructure/service-explorer-catalogue';
import { readExplorerManifest } from '@/infrastructure/service-explorer-files';
import { paramOrNull, type SearchParams } from '@/shared/search-params';

interface Params {
  readonly workspace: string;
}
export const metadata: Metadata = { title: 'Service explorer' };

export default async function ExplorerRoute({
  params,
  searchParams,
}: {
  readonly params: Promise<Params>;
  readonly searchParams: Promise<SearchParams>;
}) {
  const { workspace: id } = await params;
  const query = await searchParams;
  const history = await readEntryHistory(id, {
    scope: paramOrNull(query.scope) ?? undefined,
    service: paramOrNull(query.service) ?? undefined,
    page: paramOrNull(query.page) ?? undefined,
    node: paramOrNull(query.node) ?? undefined,
  });
  if (history !== null && history.kind !== 'unavailable') {
    return <EntryHistoryPage history={history} workspace={id} />;
  }
  const native = await readCanonicalModelIndex(id);
  if (native === null) notFound();
  const catalogue = await readExplorerCatalogue(id);
  const manifest = catalogue === null ? await readExplorerManifest(id) : null;
  if (catalogue === null && manifest === null && history !== null) {
    return <EntryHistoryPage history={history} workspace={id} />;
  }
  return (
    <WorkspaceShell
      workspace={native.model}
      nav={await readModelWorkspaceNav(native, { section: 'explorer' })}
      title="Service explorer"
    >
      <ExplorerPublication catalogue={catalogue} manifest={manifest} />
    </WorkspaceShell>
  );
}
