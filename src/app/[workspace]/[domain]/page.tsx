import { notFound } from 'next/navigation';

import { domainScopeOf } from '@/application/model-scope';
import { partsFor, type PlanPart } from '@/application/plan-footprint';
import { domainViewOf } from '@/application/workspace-domain';
import { workspaceNavOf } from '@/application/workspace-nav';
import { domainPaths } from '@/application/workspace-paths';
import { TodayMap, TodayOverlays, TodaySearch } from '@/features/plan';
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

export default async function DomainRoute({ params }: { readonly params: Promise<Params> }) {
  const { workspace: id, domain } = await params;
  const data = await todayData(id);
  const scope = data === null ? null : domainScopeOf(data.workspace, domain);
  const view = data === null ? null : domainViewOf(data.workspace, data.today.model, domain);
  if (data === null || scope === null || view === null) notFound();
  const { workspace, today, plans } = data;
  const loaded = await readLoadedPlans(workspace.id);
  const systems = workspace.domains.find((d) => d.id === domain)?.systems ?? [];
  const parts = merged(
    systems.flatMap((s) => partsFor(workspace, { domain, system: s.id }, loaded)),
  );
  return (
    <DomainPage
      actions={<TodaySearch />}
      map={<TodayMap model={today.model} scope={scope} workspace={workspace} />}
      nav={workspaceNavOf(workspace, plans, { domain, today: today.model })}
      overlays={<TodayOverlays depth={1} workspace={workspace} />}
      parts={parts}
      view={view}
    />
  );
}
