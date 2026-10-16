import { notFound } from 'next/navigation';

import { domainViewOf } from '@/application/workspace-domain';
import { CatalogueList } from '@/features/workspace';
import { todayData } from '@/infrastructure/today-data';

interface Params {
  readonly workspace: string;
  readonly domain: string;
}

// The calls the domain answers, the events it announces and the data it keeps.
export default async function DomainInterfacesRoute({
  params,
}: {
  readonly params: Promise<Params>;
}) {
  const { workspace: id, domain } = await params;
  const data = await todayData(id);
  const view = data === null ? null : domainViewOf(data.workspace, data.today.model, domain);
  if (data === null || view === null) notFound();
  return <CatalogueList catalogue={view.catalogue} />;
}
