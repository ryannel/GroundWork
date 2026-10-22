import { notFound } from 'next/navigation';

import { domainScopeOf } from '@/application/model-scope';
import { domainViewOf } from '@/application/workspace-domain';
import { TodayMap } from '@/features/plan';
import { DomainTab } from '@/features/workspace';
import { todayData } from '@/infrastructure/today-data';

interface Params {
  readonly workspace: string;
  readonly domain: string;
}

// Every component in the domain, grouped by system, with the components one step outside.
export default async function DomainMapRoute({ params }: { readonly params: Promise<Params> }) {
  const { workspace: id, domain } = await params;
  const data = await todayData(id);
  const scope = data === null ? null : domainScopeOf(data.workspace, domain);
  const view = data === null ? null : domainViewOf(data.workspace, data.today.model, domain);
  if (data === null || scope === null || view === null) notFound();
  return (
    <>
      <DomainTab
        says={`How the systems of ${view.name} work together. Unfold a system for its parts; dotted cards sit outside it, one step away.`}
        title="Map"
        view={view}
      />
      <TodayMap model={data.today.model} scope={scope} workspace={data.workspace} />
    </>
  );
}
