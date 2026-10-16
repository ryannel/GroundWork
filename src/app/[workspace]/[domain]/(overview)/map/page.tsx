import { notFound } from 'next/navigation';

import { domainScopeOf } from '@/application/model-scope';
import { TodayMap } from '@/features/plan';
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
  if (data === null || scope === null) notFound();
  return <TodayMap model={data.today.model} scope={scope} workspace={data.workspace} />;
}
