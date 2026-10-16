import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { domainScopeOf } from '@/application/model-scope';
import { partsFor, type PlanPart } from '@/application/plan-footprint';
import { domainViewOf } from '@/application/workspace-domain';
import { domainWordsOf } from '@/application/workspace-language';
import { workspaceNavOf } from '@/application/workspace-nav';
import { domainPaths } from '@/application/workspace-paths';
import { FlowList, TodayLanguage, TodayMap, TodayOverlays, TodaySearch } from '@/features/plan';
import { DomainPage } from '@/features/workspace';
import { todayData } from '@/infrastructure/today-data';
import { readLoadedPlans } from '@/infrastructure/workspace-plans';
import { readWorkspaces } from '@/infrastructure/workspace-store';

interface Params {
  readonly workspace: string;
  readonly domain: string;
}

export const dynamicParams = false;

export async function generateStaticParams(): Promise<Params[]> {
  return domainPaths(await readWorkspaces());
}

// A plan lands on a domain when it lands on any of its systems; each plan is listed once, its work summed.
function merged(parts: readonly PlanPart[]): PlanPart[] {
  const by = new Map<string, PlanPart>();
  for (const part of parts) {
    const seen = by.get(part.id);
    by.set(
      part.id,
      seen === undefined
        ? part
        : { ...seen, workItems: seen.workItems + part.workItems, done: seen.done + part.done },
    );
  }
  return [...by.values()];
}

interface Props {
  readonly params: Promise<Params>;
  readonly children: ReactNode;
}

// The domain, with the flow chosen in the list drawn beside it; each flow is its own page under flows/.
export default async function DomainLayout({ params, children }: Props) {
  const { workspace: id, domain } = await params;
  const data = await todayData(id);
  const scope = data === null ? null : domainScopeOf(data.workspace, domain);
  const view = data === null ? null : domainViewOf(data.workspace, data.today.model, domain);
  if (data === null || scope === null || view === null) notFound();
  const { workspace, today, plans } = data;
  const loaded = await readLoadedPlans(workspace.id);
  const systems = workspace.domains.find((d) => d.id === domain)?.systems ?? [];
  const words = domainWordsOf(today.languages, domain);
  const parts = merged(
    systems.flatMap((s) => partsFor(workspace, { domain, system: s.id }, loaded)),
  );
  return (
    <DomainPage
      actions={<TodaySearch />}
      flows={<FlowList flows={view.flows}>{children}</FlowList>}
      language={words === null ? null : <TodayLanguage model={today.model} words={words} />}
      map={<TodayMap model={today.model} scope={scope} workspace={workspace} />}
      nav={workspaceNavOf(workspace, plans, { domain, today: today.model })}
      overlays={<TodayOverlays depth={1} workspace={workspace} />}
      parts={parts}
      view={view}
    />
  );
}
