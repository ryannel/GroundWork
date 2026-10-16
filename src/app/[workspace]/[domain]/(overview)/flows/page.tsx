import { notFound } from 'next/navigation';

import { domainViewOf } from '@/application/workspace-domain';
import { workspaceHref } from '@/application/workspace-paths';
import { TodayFlow } from '@/features/plan';
import { todayData } from '@/infrastructure/today-data';

interface Params {
  readonly workspace: string;
  readonly domain: string;
}

// The domain's busiest flow, read first.
export default async function DomainFlowsRoute({ params }: { readonly params: Promise<Params> }) {
  const { workspace: id, domain } = await params;
  const data = await todayData(id);
  const view = data === null ? null : domainViewOf(data.workspace, data.today.model, domain);
  if (data === null || view === null) notFound();
  const first = view.flows[0];
  if (first === undefined) return <p>No flow has a step in this domain yet.</p>;
  return <TodayFlow base={workspaceHref(id)} id={first.id} model={data.today.model} />;
}
