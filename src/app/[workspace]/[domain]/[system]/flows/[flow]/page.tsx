import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { flowSlug, workspaceHref } from '@/application/workspace-paths';
import { systemViewOf } from '@/application/workspace-system';
import { TodayFlow } from '@/features/plan';
import { todayData } from '@/infrastructure/today-data';

interface Params {
  readonly workspace: string;
  readonly domain: string;
  readonly system: string;
  readonly flow: string;
}

async function systemFlowAt({ workspace: id, domain, system, flow }: Params) {
  const data = await todayData(id);
  const view = data === null ? null : systemViewOf(data.workspace, data.today, { domain, system });
  return { data, chosen: view?.flows.find((each) => flowSlug(each.id) === flow) };
}

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<Params>;
}): Promise<Metadata> {
  const { chosen } = await systemFlowAt(await params);
  return { title: chosen?.name ?? 'Flows' };
}

// One flow through the system, beside the list of all of them.
export default async function SystemFlowRoute({ params }: { readonly params: Promise<Params> }) {
  const at = await params;
  const { data, chosen } = await systemFlowAt(at);
  if (data === null || chosen === undefined) notFound();
  return <TodayFlow base={workspaceHref(at.workspace)} id={chosen.id} model={data.today.model} />;
}
