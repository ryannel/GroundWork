import { notFound } from 'next/navigation';

import { domainViewOf, systemCataloguesOf } from '@/application/workspace-domain';
import { DomainTab, SystemCatalogues } from '@/features/workspace';
import { todayData } from '@/infrastructure/today-data';

interface Params {
  readonly workspace: string;
  readonly domain: string;
}

// The calls the domain answers, the events it announces and the data it keeps, one system at a time.
export default async function DomainInterfacesRoute({
  params,
}: {
  readonly params: Promise<Params>;
}) {
  const { workspace: id, domain } = await params;
  const data = await todayData(id);
  const view = data === null ? null : domainViewOf(data.workspace, data.today.model, domain);
  if (data === null || view === null) notFound();
  return (
    <>
      <DomainTab
        says={`What ${view.name} offers everyone else, system by system: the calls it answers, the events it announces and the data it keeps. Open a row for what sits under it.`}
        title="Interfaces"
        view={view}
      />
      <SystemCatalogues systems={systemCataloguesOf(data.workspace, data.today.model, domain)} />
    </>
  );
}
