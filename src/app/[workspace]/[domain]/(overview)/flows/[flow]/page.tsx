import { notFound } from 'next/navigation';

import { domainViewOf } from '@/application/workspace-domain';
import { domainPaths, flowSlug, workspaceHref } from '@/application/workspace-paths';
import { TodayFlow } from '@/features/plan';
import { todayData } from '@/infrastructure/today-data';
import { readWorkspaces } from '@/infrastructure/workspace-store';
import { NOTHING, orNothing } from '@/shared/static-params';

interface Params {
  readonly workspace: string;
  readonly domain: string;
  readonly flow: string;
}

export const dynamicParams = false;

// Every flow of every domain, in one list: a domain with no flows would otherwise build no page at all.
export async function generateStaticParams(): Promise<Params[]> {
  const domains = domainPaths(await readWorkspaces());
  const each = await Promise.all(
    domains.map(async (path) => {
      const data = await todayData(path.workspace);
      const view =
        data === null ? null : domainViewOf(data.workspace, data.today.model, path.domain);
      return (view?.flows ?? []).map((flow) => ({ ...path, flow: flowSlug(flow.id) }));
    }),
  );
  return orNothing(each.flat(), { workspace: NOTHING, domain: NOTHING, flow: NOTHING });
}

// One flow through the domain, beside the list of all of them.
export default async function DomainFlowRoute({ params }: { readonly params: Promise<Params> }) {
  const { workspace: id, domain, flow } = await params;
  const data = await todayData(id);
  const view = data === null ? null : domainViewOf(data.workspace, data.today.model, domain);
  const chosen = view?.flows.find((each) => flowSlug(each.id) === flow);
  if (data === null || chosen === undefined) notFound();
  return <TodayFlow base={workspaceHref(id)} id={chosen.id} model={data.today.model} />;
}
