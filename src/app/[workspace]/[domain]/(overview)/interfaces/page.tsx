import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { modelDomainViewOf, modelSystemCataloguesOf } from '@/application/model-domain';
import { modelSystemAt } from '@/application/model-system';
import { DomainTab, SystemCatalogues } from '@/features/workspace';
import { readCanonicalModelIndex } from '@/infrastructure/model-index';
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
  const index = await readCanonicalModelIndex(id);
  if (index === null) notFound();
  const view = modelDomainViewOf(index, domain);
  if (view === null) notFound();
  const query = await searchParams;
  const selected = modelSystemAt(index, { domain, system: firstParam(query.system) });
  return (
    <>
      <DomainTab
        says={`What ${view.name} offers everyone else. Choose a system to see the calls it answers, the events it announces and the data it keeps. Open a name for its full details.`}
        title="Interfaces"
        view={view}
      />
      <SystemCatalogues
        selected={selected?.system.id ?? ''}
        systems={modelSystemCataloguesOf(index, domain)}
      />
    </>
  );
}
