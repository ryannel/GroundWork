import { notFound } from 'next/navigation';

import { domainPlanRowsOf } from '@/application/plan-index';
import { domainViewOf } from '@/application/workspace-domain';
import { DomainPlans, DomainTab } from '@/features/workspace';
import { todayData } from '@/infrastructure/today-data';
import { readLoadedPlans } from '@/infrastructure/workspace-plans';

interface Params {
  readonly workspace: string;
  readonly domain: string;
}

// The plans that reach the domain, read like the workspace's Plans page but narrowed to the domain: search them,
// cut them by stage, and see which other domains each one also lands in.
export default async function DomainPlansRoute({ params }: { readonly params: Promise<Params> }) {
  const { workspace: id, domain } = await params;
  const data = await todayData(id);
  const view = data === null ? null : domainViewOf(data.workspace, data.today.model, domain);
  if (data === null || view === null) notFound();
  const { workspace } = data;
  const rows = domainPlanRowsOf(workspace, await readLoadedPlans(workspace.id), domain);
  return (
    <>
      <DomainTab
        says={`The plans that change a system in ${view.name}, and how far each has got.`}
        title="Plans"
        view={view}
      />
      <DomainPlans
        domains={workspace.domains.map((d) => ({ id: d.id, name: d.name }))}
        here={domain}
        rows={rows}
      />
    </>
  );
}
