import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { domainViewOf } from '@/application/workspace-domain';
import { domainWordsOf } from '@/application/workspace-language';
import { workspaceNavOf } from '@/application/workspace-nav';
import { domainPaths } from '@/application/workspace-paths';
import { TodayOverlays, TodaySearch } from '@/features/plan';
import { DomainPage } from '@/features/workspace';
import { todayData } from '@/infrastructure/today-data';
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

// The domain's name, numbers and tabs, around whichever tab is open: the overview, flows, map, language or interfaces.
export default async function DomainLayout({ params, children }: Props) {
  const { workspace: id, domain } = await params;
  const data = await todayData(id);
  const view = data === null ? null : domainViewOf(data.workspace, data.today.model, domain);
  if (data === null || view === null) notFound();
  const { workspace, today, plans } = data;
  return (
    <DomainPage
      actions={<TodaySearch />}
      nav={workspaceNavOf(workspace, plans, { domain, today: today.model })}
      overlays={<TodayOverlays depth={1} workspace={workspace} />}
      view={view}
      words={domainWordsOf(today.languages, domain)?.concepts.length ?? 0}
    >
      {children}
    </DomainPage>
  );
}
