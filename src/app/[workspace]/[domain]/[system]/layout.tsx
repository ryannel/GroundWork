import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { domainNavOf, targetStagesOf } from '@/application/domain-nav';
import { systemScopeOf } from '@/application/model-scope';
import { partsFor } from '@/application/plan-footprint';
import { domainPlanRowsOf } from '@/application/plan-index';
import { domainViewOf } from '@/application/workspace-domain';
import { domainWordsOf } from '@/application/workspace-language';
import { systemViewOf } from '@/application/workspace-system';
import { systemImpactRows } from '@/application/workspace-work/impact';
import { FlowList, TodayMap, TodayOverlays, TodaySearch } from '@/features/plan';
import { SystemPage } from '@/features/workspace';
import { readExplorerNavigation } from '@/infrastructure/service-explorer-navigation';
import { todayData } from '@/infrastructure/today-data';
import { readWorkspacePlanIndex } from '@/infrastructure/workspace-plan-index';
import { readLoadedPlans } from '@/infrastructure/workspace-plans';

interface Params {
  readonly workspace: string;
  readonly domain: string;
  readonly system: string;
}

// Every page of the system names the system after its own title.
export async function generateMetadata({
  params,
}: {
  readonly params: Promise<Params>;
}): Promise<Metadata> {
  const { workspace: id, domain, system } = await params;
  const data = await todayData(id);
  const view = data === null ? null : systemViewOf(data.workspace, data.today, { domain, system });
  return view === null ? {} : { title: { default: view.name, template: `%s · ${view.name}` } };
}

// The system page is a layout, so its flows can be pages of their own: picking one fetches only that flow.
export default async function SystemLayout({
  params,
  children,
}: {
  readonly params: Promise<Params>;
  readonly children: ReactNode;
}) {
  const { workspace: id, domain, system } = await params;
  const data = await todayData(id);
  const scope = data === null ? null : systemScopeOf(data.workspace, system);
  const view = data === null ? null : systemViewOf(data.workspace, data.today, { domain, system });
  const place = data === null ? null : domainViewOf(data.workspace, data.today.model, domain);
  if (data === null || scope === null || view === null || place === null) notFound();
  const { workspace, today } = data;
  const explorer = await readExplorerNavigation(id, {
    components: view.components.map((component) => component.chip.id),
    repositories: view.repos.map((repo) => repo.repo),
  });
  const [loaded, index] = await Promise.all([
    readLoadedPlans(workspace.id),
    readWorkspacePlanIndex(workspace.id),
  ]);
  const parts = partsFor(workspace, { domain, system }, loaded);
  const nav = domainNavOf(workspace, place, {
    words: domainWordsOf(today.languages, domain)?.concepts.length ?? 0,
    plans: domainPlanRowsOf(workspace, loaded, domain).length,
    stages: targetStagesOf(today.targets, domain),
    system: {
      id: system,
      flows: view.flows.length > 0,
      data: view.data.length > 0,
    },
  });
  return (
    <SystemPage
      actions={<TodaySearch />}
      explorerLinks={explorer.components}
      explorerRepositories={explorer.repositories}
      flows={<FlowList flows={view.flows}>{children}</FlowList>}
      impact={systemImpactRows(index, { id: `sys:${system}`, name: view.name })}
      map={<TodayMap model={today.model} scope={scope} workspace={workspace} />}
      nav={nav}
      overlays={<TodayOverlays workspace={workspace} />}
      parts={parts}
      view={view}
    />
  );
}
