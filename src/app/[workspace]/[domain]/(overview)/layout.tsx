import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { domainNavOf, targetStagesOf } from '@/application/domain-nav';
import { domainPlanRowsOf } from '@/application/plan-index';
import { domainViewOf } from '@/application/workspace-domain';
import { domainWordsOf } from '@/application/workspace-language';
import { domainPaths } from '@/application/workspace-paths';
import { TodayOverlays, TodaySearch } from '@/features/plan';
import { DomainPage } from '@/features/workspace';
import { todayData } from '@/infrastructure/today-data';
import { readLoadedPlans } from '@/infrastructure/workspace-plans';
import { readWorkspaces } from '@/infrastructure/workspace-store';
import { NOTHING, orNothing } from '@/shared/static-params';

interface Params {
  readonly workspace: string;
  readonly domain: string;
}

export const dynamicParams = false;

export async function generateStaticParams(): Promise<Params[]> {
  return orNothing(domainPaths(await readWorkspaces()), { workspace: NOTHING, domain: NOTHING });
}

interface Props {
  readonly params: Promise<Params>;
  readonly children: ReactNode;
}

// The domain's name and numbers, with its pages down the rail, around whichever page is open: the overview, target architecture, plans, flows, map, language or interfaces.
export default async function DomainLayout({ params, children }: Props) {
  const { workspace: id, domain } = await params;
  const data = await todayData(id);
  const view = data === null ? null : domainViewOf(data.workspace, data.today.model, domain);
  if (data === null || view === null) notFound();
  const { workspace, today } = data;
  const words = domainWordsOf(today.languages, domain)?.concepts.length ?? 0;
  const plans = domainPlanRowsOf(workspace, await readLoadedPlans(workspace.id), domain).length;
  return (
    <DomainPage
      actions={<TodaySearch />}
      nav={domainNavOf(workspace, view, {
        words,
        plans,
        stages: targetStagesOf(today.targets, domain),
      })}
      overlays={<TodayOverlays workspace={workspace} />}
      view={view}
    >
      {children}
    </DomainPage>
  );
}
