import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { domainViewOf, systemCataloguesOf } from '@/application/workspace-domain';
import { DomainTab, SystemCatalogues } from '@/features/workspace';
import { todayData } from '@/infrastructure/today-data';
import { firstParam, type SearchParams } from '@/shared/search-params';

interface Params {
  readonly workspace: string;
  readonly domain: string;
}

// The calls the domain answers, the events it announces and the data it keeps, one system at a time.
export const metadata: Metadata = { title: 'Interfaces' };

export default async function DomainInterfacesRoute({
  params,
  searchParams,
}: {
  readonly params: Promise<Params>;
  readonly searchParams: Promise<SearchParams>;
}) {
  const { workspace: id, domain } = await params;
  const [data, query] = await Promise.all([todayData(id), searchParams]);
  const view = data === null ? null : domainViewOf(data.workspace, data.today.model, domain);
  if (data === null || view === null) notFound();
  return (
    <>
      <DomainTab
        says={`What ${view.name} offers everyone else. Choose a system to see the calls it answers, the events it announces and the data it keeps. Open a name for its full details.`}
        title="Interfaces"
        view={view}
      />
      <SystemCatalogues
        selected={firstParam(query.system)}
        systems={systemCataloguesOf(data.workspace, data.today.model, domain)}
      />
    </>
  );
}
