import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { domainNavOf, targetStagesOf } from '@/application/domain-nav';
import { domainPlanRowsOf } from '@/application/plan-index';
import { domainViewOf } from '@/application/workspace-domain';
import { domainWordsOf } from '@/application/workspace-language';
import { TodayOverlays, TodaySearch } from '@/features/plan';
import { DomainPage } from '@/features/workspace';
import { todayData } from '@/infrastructure/today-data';
import { readLoadedPlans } from '@/infrastructure/workspace-plans';

interface Params {
  readonly workspace: string;
  readonly domain: string;
}

interface Props {
  readonly params: Promise<Params>;
  readonly children: ReactNode;
}

// Every page of the domain names the domain after its own title.
export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { workspace: id, domain } = await params;
  const data = await todayData(id);
  const name = data?.workspace.domains.find((each) => each.id === domain)?.name;
  return name === undefined ? {} : { title: { default: name, template: `%s · ${name}` } };
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
