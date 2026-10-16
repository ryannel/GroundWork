import { notFound } from 'next/navigation';

import { workspaceHref } from '@/application/workspace-paths';
import { systemViewOf } from '@/application/workspace-system';
import { TodayFlow } from '@/features/plan';
import { todayData } from '@/infrastructure/today-data';

interface Params {
  readonly workspace: string;
  readonly domain: string;
  readonly system: string;
}

// The system's busiest flow, read first.
export default async function SystemRoute({ params }: { readonly params: Promise<Params> }) {
  const { workspace: id, domain, system } = await params;
  const data = await todayData(id);
  const view = data === null ? null : systemViewOf(data.workspace, data.today, { domain, system });
  if (data === null || view === null) notFound();
  const first = view.flows[0];
  if (first === undefined) return null;
  return <TodayFlow base={workspaceHref(id)} id={first.id} model={data.today.model} />;
}
