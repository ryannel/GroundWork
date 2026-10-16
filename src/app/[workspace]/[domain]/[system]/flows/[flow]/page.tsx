import { notFound } from 'next/navigation';

import { flowSlug, systemPaths, workspaceHref } from '@/application/workspace-paths';
import { systemViewOf } from '@/application/workspace-system';
import { TodayFlow } from '@/features/plan';
import { todayData } from '@/infrastructure/today-data';
import { readWorkspaces } from '@/infrastructure/workspace-store';

interface Params {
  readonly workspace: string;
  readonly domain: string;
  readonly system: string;
  readonly flow: string;
}

export const dynamicParams = false;

// Every flow of every system, in one list: a system with no flows would otherwise build no page at all.
export async function generateStaticParams(): Promise<Params[]> {
  const systems = systemPaths(await readWorkspaces());
  const each = await Promise.all(
    systems.map(async (path) => {
      const data = await todayData(path.workspace);
      const view = data === null ? null : systemViewOf(data.workspace, data.today, path);
      return (view?.flows ?? []).map((flow) => ({ ...path, flow: flowSlug(flow.id) }));
    }),
  );
  return each.flat();
}

// One flow through the system, beside the list of all of them.
export default async function SystemFlowRoute({ params }: { readonly params: Promise<Params> }) {
  const { workspace: id, domain, system, flow } = await params;
  const data = await todayData(id);
  const view = data === null ? null : systemViewOf(data.workspace, data.today, { domain, system });
  const chosen = view?.flows.find((each) => flowSlug(each.id) === flow);
  if (data === null || chosen === undefined) notFound();
  return <TodayFlow base={workspaceHref(id)} id={chosen.id} model={data.today.model} />;
}
