import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { domainViewOf } from '@/application/workspace-domain';
import { flowSlug, workspaceHref } from '@/application/workspace-paths';
import { TodayFlow } from '@/features/plan';
import { todayData } from '@/infrastructure/today-data';

interface Params {
  readonly workspace: string;
  readonly domain: string;
  readonly flow: string;
}

async function domainFlowAt({ workspace: id, domain, flow }: Params) {
  const data = await todayData(id);
  const view = data === null ? null : domainViewOf(data.workspace, data.today.model, domain);
  return { data, chosen: view?.flows.find((each) => flowSlug(each.id) === flow) };
}

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<Params>;
}): Promise<Metadata> {
  const { chosen } = await domainFlowAt(await params);
  return { title: chosen?.name ?? 'Flows' };
}

// One flow through the domain, beside the list of all of them.
export default async function DomainFlowRoute({ params }: { readonly params: Promise<Params> }) {
  const at = await params;
  const { data, chosen } = await domainFlowAt(at);
  if (data === null || chosen === undefined) notFound();
  return <TodayFlow base={workspaceHref(at.workspace)} id={chosen.id} model={data.today.model} />;
}
